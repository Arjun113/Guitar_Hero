import { Circle, NoteBallAssociation, ObjectId, State, ViewType, Body, Action, MusicNote, Key } from "./types.ts";
import { calcNoteStartingPos, except, Vec } from "./util.ts";
import { Viewport } from "./main.ts";
import { not } from "rxjs/internal/util/not";
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
    expiredNotes: [] as Body[],
    noteStatus: [] as {playStatus: string, note: Body}[]
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

    apply (s: State): State {
        return Tick.handleExpiredNotes({
            ...s, time: this.timeElapsed, notesToPlay: s.notesToPlay.map(Tick.moveBody(s)),
        })
    }

    static moveBody = (s:State) => (o: Body) : Body => ({
        ...o,
        pos: o.pos.add(o.vel),
        vel: o.vel.scale(s.multiplier)
    })

    static handleExpiredNotes = (s: State): State => {
        const expiredNoteCriteria = (bodyNote: Body) => (bodyNote.pos.y) > 350;

        const expiredNotes = s.notesToPlay.filter(expiredNoteCriteria);
        const expiredNoteStatuses = s.noteStatus.filter((note) => note.playStatus === "dead")

        const livingNotes = except((a: Body) => (b: Body) => a.note === b.note)(s.notesToPlay)(expiredNotes)
        const livingNoteStatuses = s.noteStatus.filter((note) => note.playStatus === "ready")

        return {...s,
        expiredNotes: expiredNotes.concat(expiredNoteStatuses.map((note)=> note.note)),
        notesToPlay: livingNotes,
        noteStatus: livingNoteStatuses}
    }

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
        function findNotesToPlay(keyColour: string, state: State): Body[] {
            if (keyColour == "red") {
                return state.notesToPlay.filter((note) => note.note.pitch < 32 && note.note.pitch >= 0 && Math.abs(note.note.start - note.createTime) < 0.04)
            }
            else if (keyColour == "green") {
                return state.notesToPlay.filter((note) => note.note.pitch < 64 && note.note.pitch >= 32 && Math.abs(note.note.start - note.createTime) < 0.04)
            }
            else if (keyColour == "blue") {
                return state.notesToPlay.filter((note) => note.note.pitch < 96 && note.note.pitch >= 64 && Math.abs(note.note.start - note.createTime) < 0.04)
            }
            else {
                return state.notesToPlay.filter((note) => note.note.pitch < 128 && note.note.pitch >= 96 && Math.abs(note.note.start - note.createTime) < 0.04)
            }
        }

        const playableNotes = findNotesToPlay(this.keyColour, s);

        return {...s, noteStatus: playableNotes.map((note_body) => ({playStatus: "ready", note: note_body}))}
    }
}

class releaseNoteKey implements Action {
    constructor (public readonly keyColour: string) {

    }
    apply = (s: State) => {
        function findNotesToRelease(keyColour: string, state: State): { playStatus: string, note: Body }[] {
            if (keyColour == "red") {
                return state.noteStatus.filter((note) => note.note.note.pitch < 32 && note.note.note.pitch >= 0 && (note.note.note.end - note.note.note.start) > 1)
            }
            else if (keyColour == "green") {
                return state.noteStatus.filter((note) => note.note.note.pitch < 64 && note.note.note.pitch >= 32 && (note.note.note.end - note.note.note.start) > 1)
            }
            else if (keyColour == "blue") {
                return state.noteStatus.filter((note) => note.note.note.pitch < 96 && note.note.note.pitch >= 64 && (note.note.note.end - note.note.note.start) > 1)
            }
            else {
                return state.noteStatus.filter((note) => note.note.note.pitch && note.note.note.pitch >= 96 && (note.note.note.end - note.note.note.start) > 1)
            }
        }

        const releasableLongNotes = findNotesToRelease(this.keyColour, s).map((noteBody) => noteBody.note);
        return {...s,
            noteStatus: s.noteStatus.filter((note) => !(releasableLongNotes.includes(note.note)))
                .concat(releasableLongNotes.map((noteBody) => ({playStatus: "stop", note: noteBody})))}
    }
}

const reduceState = (action: Action, state: State) => action.apply(state);