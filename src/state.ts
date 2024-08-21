import { Circle, NoteBallAssociation, ObjectId, State, ViewType, Body, Action, MusicNote, Key } from "./types.ts";
import { Note } from "tone/build/esm/core/type/NoteUnits";
export {initialState}

const initialState: State = {
    gameEnd: false,
    multiplier: 1,
    score: 0,
    highscore: 0,
    time: 0,
    notesToPlay: [] as Body[],
    notesAuto: [] as MusicNote[],
    total_notes_user: 0,
    expiredNotes: [] as Body[]
} as const;

// ShortNotes and LongNotes are both just Circles, and a Circle is a Body which participates in the movement and notes
const createCircle = (viewType: ViewType) => (oid: ObjectId) => (circ: Circle) => (note: MusicNote) => (vel: Vec): Body => ({
    ...oid,
    ...circ,
    vel: vel,
    id: viewType + oid.id,
    viewType: viewType,
    note: note
})

const createSmallNote = createCircle("ShortNote")
const createLongNote = createCircle("LongNote")

// STATE MODIFIERS

class Tick implements Action {
    constructor (public readonly timeElapsed: number) {}

    apply = (s: State): State => ({
        ...s
    })
}

class addUserNote implements Action{
    constructor(public readonly note: MusicNote) {}

    apply = (s: State) => ({
       ...s // Add modifications here
    })
}

class addSelfNote implements Action {
    constructor(public readonly note: MusicNote) {}

    apply = (s: State) => ({
        ...s // Add modifications here
    })
}

class pressNoteKey implements Action {
    constructor (public readonly key: Key) {}

    apply = (s: State) => ({
        ...s // Add modifications here
    })
}

const reduceState = (action: Action, state: State) => action.apply(state);