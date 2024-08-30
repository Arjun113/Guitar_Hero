/**
 * Imports required modules and functions for the application.
 * - rxjs for reactive programming with Observables
 * - tone for handling musical samples
 * - types for custom TypeScript types
 * - state for managing game state
 * - view for updating the game view
 * - util for utility functions
 */
import "./style.css";
import {
    fromEvent,
    interval,
    merge,
    Observable,
    Subscription, tap,
} from "rxjs";
import { map, filter, scan } from "rxjs/operators";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";
import { Key, MusicNote, State, Event} from "./types.ts";
import { pressNoteKey, reduceState, releaseNoteKey, Tick, switchSong, restartSong } from "./state.ts";
import { updateView } from "./view.ts";
import { Sampler } from "tone";
export { Note, Viewport, Constants, loadSong }

/**
 * Defines constants used throughout the application.
 */
const Viewport = {
    CANVAS_WIDTH: 200,
    CANVAS_HEIGHT: 400,
} as const;

const Constants = {
    TICK_RATE_MS: 10, // Interval between ticks in milliseconds
    SONG_NAME: ["RockinRobin", "TokyoGhoulOP3", "IWonder"], // List of available song names
    STARTING_SONG_INDEX: 1 // Index of the song to start with
} as const;

const Note = {
    RADIUS: 0.07 * Viewport.CANVAS_WIDTH, // Radius of the note circles
    TAIL_WIDTH: 10 // Width of the note tails
} as const;

/**
 * Loads song data from CSV contents based on the given song index.
 * @param songIndex - Index of the song to load
 * @param csvContents - Array of CSV strings for each song
 * @returns Array of MusicNote objects
 */
const loadSong = (songIndex: number, csvContents: string[]): MusicNote[] => {
    const lines = csvContents[songIndex].split("\n");
    const noteSeries = lines.map((line) => ({
        userPlayed: Boolean(line.split(',')[0] === "True"),
        instrument: line.split(',')[1],
        velocity: parseFloat(line.split(',')[2]),
        pitch: parseFloat(line.split(',')[3]),
        start: parseFloat(line.split(',')[4]),
        end: parseFloat(line.split(',')[5])
    }) as MusicNote);

    noteSeries.shift(); // Remove header or empty line

    return noteSeries;
}

/**
 * Initializes and runs the main game loop.
 * Sets up observables for game actions and updates the game state.
 * @param csv_contents - Array of CSV contents for songs
 * @param samples - Object containing the loaded audio samples
 */
export function main(csv_contents: string[], samples: { [p: string]: Sampler }) {

    // Observable for keyboard events filtered by specific keys and prevent repetition (since we use keydown and not keypress)
    const key$ = (e: Event, k: Key) =>
        fromEvent<KeyboardEvent>(document, e)
            .pipe(
                filter(({code}) => code === k),
                filter(({repeat}) => !repeat)
            );

    // Observable that emits a tick at regular intervals
    const tick$ = interval(Constants.TICK_RATE_MS)
        .pipe(
            scan((acc, _) => acc + (Constants.TICK_RATE_MS / 1000), 0),
            map((acc) => new Tick(acc))
        );

    // Initial game state setup
    const initialState: State = {
        gameEnd: false,
        multiplier: 1,
        score: 0,
        highscore: 0,
        time: 0,
        userNotes: loadSong(Constants.STARTING_SONG_INDEX, csv_contents).filter((note) => note.userPlayed),
        keyPressed: "",
        keyReleased: "",
        onscreenNotes: [],
        expiredNotes: [],
        automaticNotes: loadSong(Constants.STARTING_SONG_INDEX, csv_contents).filter((note) => !note.userPlayed)
            .map((note) => ({ playStatus: "ready", note: note })),
        notesPlayed: 0,
        notesMissed: 0,
        samples: samples,
        totalNotes: 0,
        simultaneousNotes: 0,
        lastResetTime: 0,
        currentSongIndex: Constants.STARTING_SONG_INDEX,
        resetCanvas: false
    } as const;

    /**
     * Observables for key actions and automated note insertions
     */
    const pressRedNote$ = key$('keydown', 'KeyJ').pipe(map(_ => new pressNoteKey("red"))),
        pressGreenNote$ = key$('keydown', 'KeyH').pipe(map(_ => new pressNoteKey("green"))),
        pressYellowNote$ = key$('keydown', 'KeyL').pipe(map(_ => new pressNoteKey("yellow"))),
        pressBlueNote$ = key$('keydown', 'KeyK').pipe(map(_ => new pressNoteKey("blue"))),
        releaseRedNote$ = key$('keyup', 'KeyJ').pipe(map(_ => new releaseNoteKey("red"))),
        releaseYellowNote$ = key$('keyup', 'KeyL').pipe(map(_ => new releaseNoteKey("yellow"))),
        releaseGreenNote$ = key$('keyup', 'KeyH').pipe(map(_ => new releaseNoteKey("green"))),
        releaseBlueNote$ = key$('keyup', 'KeyK').pipe(map(_ => new releaseNoteKey("blue"))),
        switchToLeftSong$ = key$("keydown", 'ArrowLeft').pipe(map(_ => new switchSong("previous", csv_contents))),
        switchToRightSong$ = key$("keydown", 'ArrowRight').pipe(map(_ => new switchSong("next", csv_contents))),
        resetGame$ = key$("keydown", 'Enter').pipe(map(_ => new restartSong(csv_contents)));

    // Merge all actions and note additions into a single observable
    const action$ = merge(tick$, pressGreenNote$, pressRedNote$, pressBlueNote$, pressYellowNote$,
        releaseYellowNote$, releaseGreenNote$, releaseRedNote$, releaseBlueNote$, switchToRightSong$, switchToLeftSong$, resetGame$);

    // Accumulate and transduce the states
    const state$: Observable<State> = action$.pipe(
        scan((acc_state, new_act) => reduceState(new_act, acc_state), initialState)
    );

    // Subscribe to state changes and update the view
    const subscription: Subscription = state$.subscribe(updateView(() => subscription.unsubscribe()));
}

/**
 * Sets up visual feedback for key presses by highlighting corresponding elements.
 */
function showKeys() {
    function showKey(k: Key) {
        const arrowKey = document.getElementById(k);
        // getElement might be null, in this case return without doing anything
        if (!arrowKey) return;
        const o = (e: Event) => fromEvent<KeyboardEvent>(document, e).pipe(
            filter(({ code }) => code === k));
        o('keydown').subscribe(e => arrowKey.classList.add("highlight"));
        o('keyup').subscribe(_ => arrowKey.classList.remove("highlight"));
    }
    showKey('ArrowLeft');
    showKey('ArrowRight');
    showKey('KeyH');
    showKey('KeyL');
    showKey("KeyK");
    showKey('KeyJ');
    showKey('Enter');
}

// The following runs your main function when the window loads. It initializes game and key events.
if (typeof window !== "undefined") {
    // Load in the instruments and then start your game!
    const samples = SampleLibrary.load({
        instruments: [
            "bass-electric",
            "violin",
            "piano",
            "trumpet",
            "saxophone",
            "trombone",
            "flute",
        ],
        baseUrl: "samples/",
    });

    const start_game = (contents: string[]) => {
        document.body.addEventListener(
            "mousedown",
            function () {
                main(contents, samples);
                showKeys();
            },
            { once: true },
        );
    };

    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

    Tone.ToneAudioBuffer.loaded().then(() => {
        // Limit the max volume to prevent sampler clipping
        // Clipping is very prevalent in TokyoGhoul and similar due to their (over)use of one instrument
        const volumeReducer = new Tone.Volume(-8).toDestination();

        for (const instrument in samples) {
            samples[instrument].connect(volumeReducer); // Pipe everything through a master volume controller
            samples[instrument].release = 0.5;
        }

        // Ensure that every song loads (or atleast attempts to) by initiating a JS Promise.
        Promise.all(Constants.SONG_NAME.map(songName =>
            fetch(`${baseUrl}/assets/${songName}.csv`)
                .then((response) => response.text())
        ))
            .then((contentsArray) => start_game(contentsArray))
            .catch((error) =>
                console.error("Error fetching the CSV files:", error),
            );
    });
}
