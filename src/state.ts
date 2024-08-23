import {
    Circle,
    NoteBallAssociation,
    ObjectId,
    State,
    ViewType,
    Body,
    Action,
    MusicNote,
    Key,
    noteStatusItem,
} from "./types.ts";
import { between, calcNoteStartingPos, except, Vec } from "./util.ts";
import { Viewport } from "./main.ts";
import { not } from "./util.ts";
import { BehaviorSubject, Observable, Subject, take } from "rxjs";
export {initialState}

const initialState: State = {
    gameEnd: false,
    multiplier: 1,
    score: 0,
    highscore: 0,
    time: 0,
    shortNoteStatus: [] as noteStatusItem[],
    notesAuto: [] as MusicNote[],
    total_notes_user: 0,
    expiredNotes: [] as noteStatusItem[],
    longNoteStatus: [] as noteStatusItem[]
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
    constructor(public readonly timeElapsed: number) {
    }

    apply(s: State): State {
        return Tick.handleExpiredNotes({
            ...s, time: this.timeElapsed, shortNoteStatus: s.shortNoteStatus.map(Tick.moveNote(s)),
            longNoteStatus: s.longNoteStatus.map(Tick.moveNote(s))
        })
    }

    static moveNote = (s: State) => (noteStatusItem: noteStatusItem): noteStatusItem => ({
        ...noteStatusItem,
        musicNote: {
            ...noteStatusItem.musicNote, pos: noteStatusItem.musicNote.pos.add(noteStatusItem.musicNote.vel),
            vel: noteStatusItem.musicNote.vel.scale(s.multiplier)
        }
    })

    static handleExpiredNotes = (s: State): State => {
        const shortExpiredNoteCriteria = (noteItem: noteStatusItem) => (noteItem.playStatus === "played" || noteItem.playStatus === "ignored" || noteItem.musicNote.note.end <= s.time);
        const longExpiredNoteCriteria = (noteItem: noteStatusItem) => (noteItem.playStatus === "dead" || noteItem.musicNote.note.end <= s.time);

        const expiredShortNotes = s.shortNoteStatus.filter(shortExpiredNoteCriteria);
        const expiredLongNotes = s.longNoteStatus.filter(longExpiredNoteCriteria);
        const livingShortNotes = s.shortNoteStatus.filter(not(shortExpiredNoteCriteria));
        const livingLongNotes = s.longNoteStatus.filter(not(longExpiredNoteCriteria));


        return {
            ...s,
            expiredNotes: expiredShortNotes.concat(expiredLongNotes),
            shortNoteStatus: livingShortNotes,
            longNoteStatus: livingLongNotes
        }
    }

    static changeNoteStatus = (s: State): State => {
        const missedNotes = (noteItem: noteStatusItem) => (noteItem.playStatus === "ready" && noteItem.musicNote.note.start > s.time)

        const missedShortNotes = s.shortNoteStatus.filter(missedNotes).map((note) => ({
            playStatus: "ignored",
            musicNote: note.musicNote
        } as noteStatusItem));
        const notMissedShortNotes = s.shortNoteStatus.filter(not(missedNotes));
        const missedLongNotes = s.longNoteStatus.filter(missedNotes).map((note) => ({
            playStatus: "ignored",
            musicNote: note.musicNote
        } as noteStatusItem));
        const notMissedLongNotes = s.longNoteStatus.filter(missedNotes);

        return {
            ...s,
            shortNoteStatus: notMissedShortNotes.concat(missedShortNotes),
            longNoteStatus: notMissedLongNotes.concat(missedLongNotes)
        }

    }
}

class addUserNote implements Action{
    constructor(public readonly note: MusicNote) {}

    apply (s: State): State {
       if (this.note.end - this.note.start < 1) {
           return {...s, shortNoteStatus: s.shortNoteStatus.concat(({playStatus: "ready",
                   musicNote: createSmallNote({id: s.total_notes_user.toString(), createTime: s.time})
                   (calcNoteStartingPos(this.note))(this.note)(new Vec(0, Viewport.CANVAS_HEIGHT / 2))} as noteStatusItem)),
                total_notes_user: s.total_notes_user + 1}
       }
       else {
           return {...s, longNoteStatus: s.longNoteStatus.concat(({playStatus: "ready",
                   musicNote: createLongNote({id: s.total_notes_user.toString(), createTime: s.time})
                   (calcNoteStartingPos(this.note))(this.note)(new Vec(0, Viewport.CANVAS_HEIGHT / 2))} as noteStatusItem)),
               total_notes_user: s.total_notes_user + 1}
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
        function findNotesToPlay(keyColour: string, notesList: noteStatusItem[]): noteStatusItem[] {
            if (keyColour == "red") {
                return notesList.filter((note) => between(note.musicNote.note.pitch, 0, 32) && Math.abs(note.musicNote.note.start - note.musicNote.createTime) < 0.04)
            }
            else if (keyColour == "green") {
                return notesList.filter((note) => between(note.musicNote.note.pitch, 32, 64) && Math.abs(note.musicNote.note.start - note.musicNote.createTime) < 0.04)
            }
            else if (keyColour == "blue") {
                return notesList.filter((note) => between(note.musicNote.note.pitch, 64, 96) && Math.abs(note.musicNote.note.start - note.musicNote.createTime) < 0.04)
            }
            else {
                return notesList.filter((note) => between(note.musicNote.note.pitch, 96, 128) && Math.abs(note.musicNote.note.start - note.musicNote.createTime) < 0.04)
            }
        }

        const playableShortNotes = findNotesToPlay(this.keyColour, s.shortNoteStatus);
        const notPlayableShortNotes = s.shortNoteStatus.filter(not(playableShortNotes.includes));
        const playableLongNotes = findNotesToPlay(this.keyColour, s.longNoteStatus);
        const notPlayableLongNotes = s.longNoteStatus.filter(not(playableShortNotes.includes));

        return {...s,
                shortNoteStatus: notPlayableShortNotes.concat(playableShortNotes.map((note) => ({playStatus: "pressed", musicNote: note.musicNote} as noteStatusItem))),
                longNoteStatus: notPlayableLongNotes.concat(playableLongNotes.map((note) => ({playStatus: "pressed", musicNote: note.musicNote} as noteStatusItem)))}
    }
}

class releaseNoteKey implements Action {
    constructor (public readonly keyColour: string) {

    }
    apply = (s: State) => {
        function findNotesToRelease(keyColour: string, notesList: noteStatusItem[]): noteStatusItem[] {
            if (keyColour == "red") {
                return notesList.filter((note) => between(note.musicNote.note.pitch, 0, 32) && note.playStatus === "pressed");
            }
            else if (keyColour == "green") {
                return notesList.filter((note) => between(note.musicNote.note.pitch, 32, 64) && note.playStatus === "pressed")
            }
            else if (keyColour == "blue") {
                return notesList.filter((note) => between(note.musicNote.note.pitch, 64, 96) && note.playStatus === "pressed")
            }
            else {
                return notesList.filter((note) => between(note.musicNote.note.pitch, 96, 128) && note.playStatus === "pressed")
            }
        }

        const releasableLongNotes = findNotesToRelease(this.keyColour, s.longNoteStatus);
        const notReleasableLongNotes = s.shortNoteStatus.filter(not(releasableLongNotes.includes));
        return {...s,
            longNoteStatus: notReleasableLongNotes.concat(releasableLongNotes.map((note) => ({playStatus: "dead", musicNote: note.musicNote})))}
    }
}

const reduceState = (action: Action, state: State) => action.apply(state);
