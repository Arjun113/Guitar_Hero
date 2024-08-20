export type {Key, Event, MusicNote, NoteBallAssociation, State}

/** User input */

type Key = "KeyH" | "KeyJ" | "KeyK" | "KeyL";

type Event = "keydown" | "keyup" | "keypress";


type MusicNote = Readonly<{
    userPlayed: boolean,
    instrument: string,
    velocity: number,
    pitch: number,
    start: number,
    end: number
}>;

type NoteBallAssociation = Readonly<{
    note: MusicNote,
    ball: SVGElement
}>

type State = Readonly<{
    gameEnd: boolean;
    noteBallAssociations: NoteBallAssociation[],
    multiplier: number,
    score: number,
    highscore: number
}>;

type Circle = Readonly<{ pos: Vec, radius: number }>

/**
 * ObjectIds help us identify objects and manage objects which timeout (such as bullets)
 */
type ObjectId = Readonly<{ id: string, createTime: number }>

/**
 * Every object that participates in physics is a Body
 */
type Body = Circle & ObjectId & Readonly<{
    viewType: ViewType,
    vel: Vec
}>

type ViewType = "ShortNote" | "LongNote"

/**
 * Actions modify state
 */
interface Action {
    apply(s: State): State;
}
