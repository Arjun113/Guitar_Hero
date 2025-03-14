import {
    ObjectId,
    State,
    ViewType,
    Body,
    Action,
    MusicNote,
    NoteStatusItem, SVGGroup, KeyColour, SongSwitchWays,
} from "./types.ts";
import { between, calcNoteStartingPos, cut, filterForColour, mod, Vec } from "./util.ts";
import { Constants, loadSong } from "./main.ts";

export {Tick, pressNoteKey, releaseNoteKey, reduceState, switchSong, restartSong}



/**
 * Creates a Circle (Body) for different note types (ShortNote, LongNote).
 * @param viewType - The view type of the note (e.g., "ShortNote", "LongNote")
 * @returns A function that takes an ObjectId, SVGGroup, MusicNote, and Vec to create a Body
 */
const createCircle = (viewType: ViewType) => (oid: ObjectId) => (svgs: SVGGroup) => (note: MusicNote) => (vel: Vec): Body => ({
    ...oid,
    ...svgs,
    vel: vel,
    id: oid.id,
    viewType: viewType,
    note: note
})

// ShortNotes and LongNotes are both just Circles, and a Circle is a Body which participates in the movement and notes
const createSmallNote = createCircle("ShortNote")
const createLongNote = createCircle("LongNote")

// STATE MODIFIERS

/**
 * Represents a Tick action that handles the updating of game state over time.
 */
class Tick implements Action {
    constructor(public readonly timeElapsed: number) {
    }

    /**
     * Applies the Tick action to update the state.
     * @param s - The current state
     * @returns The updated state
     */
    apply = (s: State): State => Tick.noteManagement({
        ...s, onscreenNotes: s.onscreenNotes.map((note) =>
            ({playStatus: note.playStatus, musicNote:Tick.moveBody(note.musicNote)})),
        expiredNotes: [], gameEnd: (s.automaticNotes.length === 1 && s.userNotes.length === 0 && s.onscreenNotes.length === 0),
        keyPressed: "", keyReleased: "",
        time: this.timeElapsed - 2,
        automaticNotes: s.automaticNotes.filter((note) => note.playStatus !== "pressed"),
        multiplier: 1 + 0.2 * Math.trunc(s.simultaneousNotes / 10),
        resetCanvas: false
    })

    /**
     * all tick-based physical movement comes through this function
     * @param body a Body to move
     * @returns the moved Body
     */
    static moveBody = (body: Body): Body => ({
        ...body,
        svgElems: {circle: ({...body.svgElems.circle, pos: body.svgElems.circle.pos.add(body.vel.scale(Constants.TICK_RATE_MS/1000))}),
                    tail: ({...body.svgElems.tail, pos: body.svgElems.tail.pos.add(body.vel.scale(Constants.TICK_RATE_MS/1000))})}
    })

        /**
         * Manages notes by filtering and updating them based on their status.
         * @param s - The current state
         * @returns The updated state with new, expired, and managed notes
         */
    static noteManagement = (s: State): State => {
            // Filter the user notes that are within a valid time range relative to the current time
            const newUserNotes = s.userNotes.filter((note) =>
                between(note.start - s.time + s.lastResetTime - 2,
                    -(Constants.TICK_RATE_MS * 2) / 1000 - 2,
                    Constants.TICK_RATE_MS * 2 / 1000)
            );

            // Create small note bodies for notes with duration less than 1 second
            const newShortNoteBodies = newUserNotes
                .filter((note) => (note.end - note.start) < 1)
                .map((note, i) =>
                    createSmallNote({ id: (s.totalNotes + i).toString(), createTime: (s.time + s.lastResetTime) })
                    (calcNoteStartingPos(note)(s.time - s.lastResetTime))(note)(new Vec(0, 175))
                )
                .map((body) => ({ playStatus: "ready", musicNote: body })); // Scheduler assigns "ready"

            // Track the number of new short note bodies
            const numberOfNewObjects = newShortNoteBodies.length;

            // Create long note bodies for notes with duration equal to or greater than 1 second
            const newLongNoteBodies = newUserNotes
                .filter((note) => (note.end - note.start) >= 1)
                .map((note, i) =>
                    createLongNote({ id: (s.totalNotes + i + numberOfNewObjects).toString(), createTime: (s.time + s.lastResetTime) })
                    (calcNoteStartingPos(note)(s.time - s.lastResetTime))(note)(new Vec(0, 175))
                )
                .map((body) => ({ playStatus: "ready", musicNote: body })); // Scheduler assigns "ready"


            // Filter out expired notes based on the current time
            // Explanation for long logic statement: the entity expiredNotes consists of notes
            // who fit in atleast one of three categories:
            // 1. Notes whose ending time has surpassed the current time in state
            // 2. Short notes which have been played
            // 3. Long notes which have been released.
            // This entry is for View to get rid of all these from the HTML page
            const expiredNotes = s.onscreenNotes.filter((note) =>
                ((s.time - s.lastResetTime) > note.musicNote.note.end)
                || (note.musicNote.note.end - note.musicNote.note.start < 1 && note.playStatus === "pressed") ||
                (note.musicNote.note.end - note.musicNote.note.start < 1 && note.playStatus === "released")
            );

            // Get notes that are already played or released
            const playedNotes = s.onscreenNotes.filter((note) =>
                (((note.musicNote.note.end - note.musicNote.note.start) < 1 && note.playStatus === "pressed") || note.playStatus === "released")
            );

            // Get notes that are ready to be played automatically
            // In this context, automatically means that they are not shown to user
            const readyAutomaticNotes = s.automaticNotes.filter((note) =>
                note.playStatus === "ready" && note.note.start <= (s.time - s.lastResetTime)
            );


            // Filter out user notes that are no longer playable
            const unplayableUserNotes = cut(s.userNotes)(newUserNotes);

            // Filter out onscreen notes that are expired or already played
            const unexpiredOnscreenNotes = cut(cut(s.onscreenNotes)(expiredNotes))(playedNotes);


            return ({
            ...s, onscreenNotes: unexpiredOnscreenNotes.concat(newShortNoteBodies, newLongNoteBodies),
                userNotes: unplayableUserNotes,
            notesMissed: s.notesMissed + expiredNotes.filter((note) =>
                note.playStatus === "ready").length,
            highscore: (s.score > s.highscore) ? s.score : s.highscore,
            expiredNotes: expiredNotes.concat(playedNotes),
            totalNotes: s.totalNotes + newShortNoteBodies.length + newLongNoteBodies.length,
            automaticNotes: cut(s.automaticNotes)(readyAutomaticNotes).concat(readyAutomaticNotes.map(
                (note) =>
                    ({playStatus: "pressed", note: note.note})))
        })


    }

}

/**
 * Represents an action to handle the pressing of a note key.
 */
class pressNoteKey implements Action {
    constructor (public readonly keyColour: KeyColour) {}

    /**
     * Applies the pressNoteKey action to update the state.
     * @param s - The current state
     * @returns The updated state
     */
    apply = (s: State): State => {

        const notesInColumn = s.onscreenNotes.filter((note)=>
            filterForColour(note.musicNote.note, this.keyColour));
        const playableNotesInColumn = notesInColumn.filter((note) =>
            between(note.musicNote.note.start - (s.time - s.lastResetTime), -0.1, 0.1))
        const unplayableNotesInColumn = cut(s.onscreenNotes)(playableNotesInColumn)


        return ({
            ...s,
            onscreenNotes: unplayableNotesInColumn.concat(playableNotesInColumn.map((note) =>
                ({playStatus: "pressed", musicNote: note.musicNote}))),
            keyPressed: (playableNotesInColumn.length === 0 ? (notesInColumn.length === 0 ? "random" : this.keyColour) : ""),
            notesPlayed: s.notesPlayed + playableNotesInColumn.filter((note) =>
                (note.musicNote.note.end - note.musicNote.note.start) < 1).length,
            score: s.score + (playableNotesInColumn.filter((note) =>
                (note.musicNote.note.end - note.musicNote.note.start) < 1).length)*s.multiplier,
            simultaneousNotes: playableNotesInColumn.length === 0 ? 0 : (s.simultaneousNotes + playableNotesInColumn.length)
        })
    }
}


/**
 * Represents an action to handle the release of a note key.
 */
class releaseNoteKey implements Action {
    constructor (public readonly keyColour: KeyColour) {
    }

    /**
     * Applies the releaseNoteKey action to update the state.
     * @param s - The current state
     * @returns The updated state
     */
    apply = (s: State): State => {

        // The condition to filter out long notes that have been pressed (played)
        const longNotes = (note: NoteStatusItem) => note.playStatus === "pressed" &&
        (note.musicNote.note.end - note.musicNote.note.start) >= 1;


        const releasedLongNotes = s.onscreenNotes.filter((note) =>
                                filterForColour(note.musicNote.note, this.keyColour)).filter(longNotes);
        const correctlyReleasedLongNotes = releasedLongNotes.filter((longnote) =>
            between(longnote.musicNote.note.end - (s.time - s.lastResetTime), -0.1, 0.1))

        return ({
            ...s, score: s.score + (correctlyReleasedLongNotes.length)*s.multiplier,
            onscreenNotes: cut(s.onscreenNotes)(releasedLongNotes),
            expiredNotes: releasedLongNotes.map((note) =>
                ({playStatus: "released", musicNote: note.musicNote})),
            simultaneousNotes: (correctlyReleasedLongNotes.length === 0 &&
                s.onscreenNotes.filter((note) =>
                                note.musicNote.note.end - note.musicNote.note.start >= 1).length !== 0) ? 0
                                : (s.simultaneousNotes + correctlyReleasedLongNotes.length)
        })

    }
}

/**
 * Represents an action to switch to the next or previous song.
 */
class switchSong implements Action {
    constructor (public readonly switchDirection: SongSwitchWays, readonly csvContents: string[]) {}

    /**
     * Applies the switchSong action to update the state.
     * @param s - The current state
     * @returns The updated state with the new song loaded
     */
    apply = (s: State): State => ({
        ...s,
        gameEnd: false,
        multiplier: 1,
        score: 0,
        highscore: s.highscore,
        time: 0,
        userNotes: loadSong(((this.switchDirection === "next" ? mod(s.currentSongIndex + 1)(Constants.SONG_NAME.length)
            : mod(s.currentSongIndex - 1)(Constants.SONG_NAME.length))), this.csvContents).filter((note) => note.userPlayed),
        keyPressed: "",
        keyReleased: "",
        onscreenNotes: [],
        expiredNotes: [],
        automaticNotes: loadSong(((this.switchDirection === "next" ? mod(s.currentSongIndex + 1)(Constants.SONG_NAME.length)
            : mod(s.currentSongIndex - 1)(Constants.SONG_NAME.length))), this.csvContents).filter((note) =>
            !note.userPlayed).map((note) => ({playStatus: "ready", note: note})),
        notesPlayed: 0,
        notesMissed: 0,
        totalNotes: 0,
        simultaneousNotes: 0,
        lastResetTime: s.time + 2,
        currentSongIndex: this.switchDirection === "next" ? mod(s.currentSongIndex + 1)(Constants.SONG_NAME.length)
            : mod(s.currentSongIndex - 1)(Constants.SONG_NAME.length),
        resetCanvas: true
    })
}

/**
 * Represents an action to restart the current song.
 */
class restartSong implements Action {
    constructor(public readonly csvContents: string[]) {
    }

    /**
     * Applies the restartSong action to reset the state with the current song.
     * @param s - The current state
     * @returns The updated state with the song reset
     */
    apply = (s: State): State => ({
        ...s,
        gameEnd: false,
        multiplier: 1,
        score: 0,
        highscore: 0,
        time: 0,
        userNotes: loadSong(s.currentSongIndex, this.csvContents).filter((note) => note.userPlayed),
        keyPressed: "",
        keyReleased: "",
        onscreenNotes: [],
        expiredNotes: [],
        automaticNotes: loadSong(s.currentSongIndex, this.csvContents).filter((note) =>
            !note.userPlayed).map((note) => ({playStatus: "ready", note: note})),
        notesPlayed: 0,
        notesMissed: 0,
        totalNotes: 0,
        simultaneousNotes: 0,
        lastResetTime: s.time + 2,
        resetCanvas: true
    })
}

/**
 * The place where the magic happens: the state transducer!
 * @param action - The Action to apply to the State
 * @param state - The state to apply the Action
 * @returns A new copy of the updated state after applying the Action on to it
 */
const reduceState = (action: Action, state: State) => action.apply(state);