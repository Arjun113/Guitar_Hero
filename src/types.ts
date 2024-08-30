import { Vec } from "./util.ts";
import { Sampler } from "tone";

export type {Key, Event, MusicNote, State, ViewType, ObjectId, Circle, Body, ColourPos, NoteStatusItem, SVGGroup, KeyColour, Tail, SongSwitchWays}
export type {Action}

/** User input */

/** Keys used in interaction */
type Key = "KeyH" | "KeyJ" | "KeyK" | "KeyL" | "ArrowLeft" | "ArrowRight" | "Enter";

/** Events possible for key interaction */
type Event = "keydown" | "keyup" | "keypress";


/** Represents the color associated with a key. */
type KeyColour = "green" | "red" | "blue" | "yellow" | "";

/** Represents the directions in which the song can be switched. */
type SongSwitchWays = "previous" | "next"

// Represents a musical note with properties such as pitch, start and end time, etc.
type MusicNote = Readonly<{
    userPlayed: boolean,
    instrument: string,
    velocity: number,
    pitch: number,
    start: number,
    end: number
}>;

// Represents a tail associated with a note, including its width, length, and position.
type State = Readonly<{
    gameEnd: boolean;
    notesPlayed: number,
    notesMissed: number
    multiplier: number,
    score: number,
    highscore: number,
    time: number,
    onscreenNotes: ReadonlyArray<NoteStatusItem>,
    expiredNotes: ReadonlyArray<NoteStatusItem>,
    keyPressed: KeyColour | "random",
    keyReleased: KeyColour | "random",
    userNotes: MusicNote[],
    automaticNotes: ReadonlyArray<{playStatus: string, note: MusicNote}>,
    samples: { [p: string]: Sampler },
    totalNotes: number,
    simultaneousNotes: number,
    lastResetTime: number,
    currentSongIndex: number,
    resetCanvas: boolean
}>;

// Represents a circle used in rendering, including its position, radius, and color.
type Circle = Readonly<{ pos: Vec, radius: number, colour: string }>

// Represents a tail associated with a note, including its width, length, and position.
type Tail = Readonly<{
    width: number,
    length: number,
    pos: Vec,
    colour: string
}>


// Represents a group of SVG elements, including a circle and a tail.
type SVGGroup = Readonly<{
    svgElems: {circle: Circle, tail: Tail}
}>

// Identifies an object with a unique ID and a creation time.
type ObjectId = Readonly<{ id: string, createTime: number }>

// Represents any object participating in physics with visual and movement properties.
type Body = SVGGroup & ObjectId & Readonly<{
    viewType: ViewType,
    vel: Vec,
    note: MusicNote
}>

// Represents the type of view for a note (ShortNote or LongNote).
type ViewType = "ShortNote" | "LongNote"

// Represents a color and its vertical position percentage.
type ColourPos = [colour: string, yPositionPercentage: number]

// Represents an action that can be applied to modify the state.
interface Action {
    apply(s: State): State;
}

// Represents the status of a note, including its play status and associated body.
// This is the heart of the scheduler-like operation in this program
// Notes have different states that are modified in the Controller (state.ts) and reflected in the View (view.ts) as per MVC
type NoteStatusItem = Readonly<{
    musicNote: Body,
    playStatus: string
}>
