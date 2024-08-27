/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import {
    concatMap, delay,
    from,
    fromEvent,
    interval,
    merge,
    mergeMap,
    Observable, of,
    Subscription,
    switchMap,
    take, tap,
    timer,
} from "rxjs";
import { map, filter, scan } from "rxjs/operators";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";
import { Key, MusicNote, State, Event, noteStatusItem, KeyColour , Body} from "./types.ts";
import { pressNoteKey, reduceState, releaseNoteKey, Tick } from "./state.ts";
import { updateView } from "./view.ts";
import { not, playNotes, RNG } from "./util.ts";
import { Sampler } from "tone";
export { Note, Viewport, Constants}

/** Constants */

const Viewport = {
    CANVAS_WIDTH: 200,
    CANVAS_HEIGHT: 400,
} as const;

const Constants = {
    TICK_RATE_MS: 10,
    SONG_NAME: "RockinRobin",
} as const;

const Note = {
    RADIUS: 0.07 * Viewport.CANVAS_WIDTH,
    TAIL_WIDTH: 10
} as const;


/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(csv_contents: string, samples: { [p: string]: Sampler }) {
    const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
        HTMLElement;
    const preview = document.querySelector(
        "#svgPreview",
    ) as SVGGraphicsElement & HTMLElement;



    const key$ = (e: Event, k: Key) =>
        fromEvent<KeyboardEvent>(document, e)
            .pipe(
                filter(({code}) => code === k))

    const tick$ = interval(Constants.TICK_RATE_MS)
        .pipe(
            scan((acc, _) => acc + (Constants.TICK_RATE_MS / 1000), 0),
            map((acc) => new Tick(acc))
        )

    const lines = csv_contents.split("\n");
    const noteSeries = lines.map((line) => ({userPlayed: Boolean(line.split(',')[0] === "True"),
        instrument: line.split(',')[1],
        velocity: parseFloat(line.split(',')[2]),
        pitch: parseFloat(line.split(',')[3]),
        start: parseFloat(line.split(',')[4]),
        end: parseFloat(line.split(',')[5])}) as MusicNote)

    noteSeries.shift()

    const initialState: State = {
        gameEnd: false,
        multiplier: 1,
        score: 0,
        highscore: 0,
        time: 0,
        userNotes: noteSeries.filter((note) => note.userPlayed),
        keyPressed: "" as KeyColour,
        keyReleased: "" as KeyColour,
        onscreenNotes: [] as noteStatusItem[],
        expiredNotes: [] as noteStatusItem[],
        automaticNotes: noteSeries.filter((note) => !note.userPlayed),
        notesPlayed: 0,
        notesMissed: 0,
        samples: samples,
        totalNotes: 0
    } as const;


    /** Key actions and automated note insertions
     */
    const pressRedNote$ = key$('keydown', 'KeyH').pipe(map(_ => new pressNoteKey("red"))),
        pressGreenNote$ = key$('keydown', 'KeyJ').pipe(map(_ => new pressNoteKey("green"))),
        pressYellowNote$ = key$('keydown', 'KeyL').pipe(map(_ => new pressNoteKey("yellow"))),
        pressBlueNote$ = key$('keydown', 'KeyK').pipe(map(_ => new pressNoteKey("blue"))),
        releaseRedNote$ = key$('keyup', 'KeyH').pipe(map(_ => new releaseNoteKey("red"))),
        releaseYellowNote$ = key$('keyup', 'KeyL').pipe(map(_ => new releaseNoteKey("yellow"))),
        releaseGreenNote$ = key$('keyup', 'KeyK').pipe(map(_ => new releaseNoteKey("green"))),
        releaseBlueNote$ = key$('keyup', 'KeyK').pipe(map(_ => new releaseNoteKey("blue")))

    // Merge all actions + note additions + tick into one mega-observable

    const action$ = merge(tick$, pressGreenNote$, pressRedNote$, pressBlueNote$, pressYellowNote$);

    // Accumulate and transduce the states
    const state$: Observable<State> = action$.pipe(
        scan((acc_state, new_act) => reduceState(new_act, acc_state), initialState)
    );
    const subscription: Subscription = state$.subscribe(updateView(() => subscription.unsubscribe(), svg));

}

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
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
        ], // SampleLibrary.list,
        baseUrl: "samples/",
    });


    const start_game = (contents: string) => {
        document.body.addEventListener(
            "mousedown",
            function () {
                main(contents, samples);
            },
            { once: true },
        );
    };

    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

    Tone.ToneAudioBuffer.loaded().then(() => {
        for (const instrument in samples) {
            samples[instrument].toDestination();
            samples[instrument].release = 0.5;
        }
        fetch(`${baseUrl}/assets/${Constants.SONG_NAME}.csv`)
            .then((response) => response.text())
            .then((text) => start_game(text))
            .catch((error) =>
                console.error("Error fetching the CSV file:", error),
            );
    })
}

