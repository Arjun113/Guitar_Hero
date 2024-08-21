import { Circle, NoteBallAssociation, ObjectId, State, ViewType, Body, Action, MusicNote, Key } from "./types.ts";
import { calcNoteStartingPos, Vec } from "./util.ts";
import { Viewport } from "./main.ts";
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
        ...s // Add mods here
    })
}

class addUserNote implements Action{
    constructor(public readonly note: MusicNote) {}

    apply (s: State): State {
       if (this.note.end - this.note.start < 1) {
           return {...s, notesToPlay: s.notesToPlay.concat(
               createSmallNote({id: s.total_notes_user.toString(), createTime: s.time})
               (calcNoteStartingPos(this.note))(this.note)(new Vec(0, Viewport.CANVAS_HEIGHT / 2))
               ),
                total_notes_user: s.total_notes_user + 1}
       }
       else {
           return {...s, notesToPlay: s.notesToPlay.concat(
                   createLongNote({id: s.total_notes_user.toString(), createTime: s.time})
                   (calcNoteStartingPos(this.note))(this.note)(new Vec(0, Viewport.CANVAS_HEIGHT / 2))
               ), total_notes_user: s.total_notes_user + 1}
       }
    }
}

class addSelfNote implements Action {
    constructor(public readonly note: MusicNote) {}

    apply = (s: State) => ({
        ...s, notesAuto: s.notesAuto.concat(this.note)
    })
}

class pressNoteKey implements Action {
    constructor (public readonly keyColour: string) {}

    apply = (s: State) => {

    }
}

const reduceState = (action: Action, state: State) => action.apply(state);