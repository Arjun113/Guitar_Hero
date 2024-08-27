import {
    Circle,
    ObjectId,
    State,
    ViewType,
    Body,
    Action,
    MusicNote,
    Key,
    noteStatusItem, SVGGroup, KeyColour,
} from "./types.ts";
import { between, calcNoteStartingPos, cut, except, playNotes, releaseNotes, Vec } from "./util.ts";
import { Constants } from "./main.ts";
import {Tail} from "./types.ts";
import { defineWorkspace } from "vitest/config";

export {Tick, pressNoteKey, releaseNoteKey, reduceState}


// ShortNotes and LongNotes are both just Circles, and a Circle is a Body which participates in the movement and notes
const createCircle = (viewType: ViewType) => (oid: ObjectId) => (svgs: SVGGroup) => (note: MusicNote) => (vel: Vec): Body => ({
    ...oid,
    ...svgs,
    vel: vel,
    id: oid.id,
    viewType: viewType,
    note: note
})

const createSmallNote = createCircle("ShortNote")
const createLongNote = createCircle("LongNote")

// STATE MODIFIERS

class Tick implements Action {
    constructor(public readonly timeElapsed: number) {
    }
    apply = (s: State): State => Tick.noteManagement({
        ...s, onscreenNotes: s.onscreenNotes.map((note) => ({playStatus: note.playStatus, musicNote:Tick.moveBody(note.musicNote)} as noteStatusItem)),
        expiredNotes: [] as Readonly<noteStatusItem>[], gameEnd: (s.automaticNotes.length === 0 && s.userNotes.length === 0 && s.onscreenNotes.length === 0),
        keyPressed: "" as KeyColour, keyReleased: "" as KeyColour,
        time: this.timeElapsed,
        automaticNotes: s.automaticNotes.filter((note) => note.playStatus !== "pressed")
    })

    /**
     * all tick-based physical movement comes through this function
     * @param body a Body to move
     * @returns the moved Body
     */
    static moveBody = (body: Body): Body => ({
        ...body,
        svgElems: {circle: ({...body.svgElems.circle, pos: body.svgElems.circle.pos.add(body.vel.scale(Constants.TICK_RATE_MS/1000))} as Circle),
                    tail: ({...body.svgElems.tail, pos: body.svgElems.tail.pos.add(body.vel.scale(Constants.TICK_RATE_MS/1000))} as Tail)}
    })

    static noteManagement = (s: State): State => {
        const newUserNotes = s.userNotes.filter((note) => between(note.start - s.time - 2, -(Constants.TICK_RATE_MS * 2)/1000, Constants.TICK_RATE_MS * 2/1000))
        const newShortNoteBodies = newUserNotes.filter((note) => (note.end - note.start) < 1).map(
            (note, i) => createSmallNote({id: (s.totalNotes + i).toString(), createTime: s.time} as ObjectId)
            (calcNoteStartingPos(note))(note)(new Vec(0, 175))).map((body) => ({playStatus: "ready", musicNote: body} as noteStatusItem))

        const numberOfNewObjects = newShortNoteBodies.length


        const newLongNoteBodies = newUserNotes.filter((note) => (note.end - note.start) >= 1).map(
            (note, i) => createSmallNote({id: (s.totalNotes + i + numberOfNewObjects).toString(), createTime: s.time} as ObjectId)
            (calcNoteStartingPos(note))(note)(new Vec(0, 175))).map((body) => ({playStatus: "ready", musicNote: body} as noteStatusItem))

        const expiredNotes = s.onscreenNotes.filter((note) => s.time > note.musicNote.note.end)
        const playedNotes = s.onscreenNotes.filter((note) => note.playStatus === "pressed")
        const readyAutomaticNotes = s.automaticNotes.filter((note) =>
            note.playStatus === "ready" && note.note.start <= s.time)

        const cutMusicNotes = except((a: MusicNote) => (b: MusicNote) => a === b)
        const cutAutoNotes = except((a: {playStatus: string, note: MusicNote}) => (b: {playStatus: string, note: MusicNote}) => a === b)
        const unplayableUserNotes = cutMusicNotes(s.userNotes)(newUserNotes)
        const unexpiredOnscreenNotes = cut(cut(s.onscreenNotes)(expiredNotes))(playedNotes)

        return ({
            ...s, onscreenNotes: unexpiredOnscreenNotes.concat(newShortNoteBodies, newLongNoteBodies), userNotes: unplayableUserNotes,
            notesMissed: s.notesMissed + expiredNotes.filter((note) => note.playStatus === "ready").length,
            highscore: (s.score > s.highscore) ? s.score : s.highscore,
            expiredNotes: expiredNotes.concat(playedNotes),
            totalNotes: s.totalNotes + newShortNoteBodies.length + newLongNoteBodies.length,
            automaticNotes: cutAutoNotes(s.automaticNotes)(readyAutomaticNotes).concat(readyAutomaticNotes.map(
                (note) => ({playStatus: "pressed", note: note.note})))
        })


    }

}


class pressNoteKey implements Action {
    constructor (public readonly keyColour: KeyColour) {}
    apply = (s: State): State => {
        function findNotesInColumn (keyColour: KeyColour): ReadonlyArray<noteStatusItem> {
            if (keyColour === "green") {
                return s.onscreenNotes.filter((note) => between(note.musicNote.note.pitch, 0, 32))
            }
            else if (keyColour === "red") {
                return s.onscreenNotes.filter((note) => between(note.musicNote.note.pitch, 32, 64))
            }
            else if (keyColour === "yellow") {
                return s.onscreenNotes.filter((note) => between(note.musicNote.note.pitch, 96, 128))
            }
            else if (keyColour === "blue") {
                return s.onscreenNotes.filter((note) => between(note.musicNote.note.pitch, 64, 96))
            }
            return [] as ReadonlyArray<noteStatusItem>
        }

        const notesInColumn = findNotesInColumn(this.keyColour);
        const playableNotesInColumn = notesInColumn.filter((note) => between(note.musicNote.note.start - s.time, -0.2, 0.2))
        const unplayableNotesInColumn = cut(s.onscreenNotes)(playableNotesInColumn)


        return ({
            ...s,
            onscreenNotes: unplayableNotesInColumn.concat(playableNotesInColumn.map((note) => ({playStatus: "pressed", musicNote: note.musicNote} as noteStatusItem))),
            keyPressed: (playableNotesInColumn.length === 0 ? (notesInColumn.length === 0 ? "random" : this.keyColour) : "" as KeyColour),
            notesPlayed: s.notesPlayed + playableNotesInColumn.filter((note) => (note.musicNote.note.end - note.musicNote.note.start) < 1).length,
            score: s.score + playableNotesInColumn.filter((note) => (note.musicNote.note.end - note.musicNote.note.start) < 1).length
        })
    }
}

class releaseNoteKey implements Action {
    constructor (public readonly keyColour: KeyColour) {
    }
    apply = (s: State): State => {
        function findLongNotesInColumn (keyColour: KeyColour): ReadonlyArray<noteStatusItem> {
            if (keyColour === "green") {
                return s.onscreenNotes.filter((note) =>
                    note.playStatus === "pressed" && between(note.musicNote.note.pitch, 0, 32))
            }
            else if (keyColour === "red") {
                return s.onscreenNotes.filter((note) =>
                    note.playStatus === "pressed" && between(note.musicNote.note.pitch, 32, 64))
            }
            else if (keyColour === "yellow") {
                return s.onscreenNotes.filter((note) =>
                    note.playStatus === "pressed" && between(note.musicNote.note.pitch, 96, 128))
            }
            else if (keyColour === "blue") {
                return s.onscreenNotes.filter((note) =>
                    note.playStatus === "pressed" && between(note.musicNote.note.pitch, 64, 96))
            }
            else {
                return [] as ReadonlyArray<noteStatusItem>
            }
        }

        const releasedLongNotes = findLongNotesInColumn(this.keyColour);
        const correctlyReleasedLongNotes = releasedLongNotes.filter((longnote) => between(longnote.musicNote.note.end - s.time, -0.02, 0.02))

        return ({
            ...s, score: s.score + correctlyReleasedLongNotes.length,
            expiredNotes: releasedLongNotes.map((note) => ({playStatus: "released", musicNote: note.musicNote} as noteStatusItem))
        })

    }
}

const reduceState = (action: Action, state: State) => action.apply(state);
