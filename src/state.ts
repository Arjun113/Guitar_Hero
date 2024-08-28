import {
    Circle,
    ObjectId,
    State,
    ViewType,
    Body,
    Action,
    MusicNote,
    Key,
    noteStatusItem, SVGGroup, KeyColour, SongSwitchWays,
} from "./types.ts";
import { between, calcNoteStartingPos, cut, except, playNotes, releaseNotes, Vec } from "./util.ts";
import { Constants, loadSong } from "./main.ts";
import {Tail} from "./types.ts";

export {Tick, pressNoteKey, releaseNoteKey, reduceState, switchSong, restartSong}


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
        ...s, onscreenNotes: s.onscreenNotes.map((note) => ({playStatus: note.playStatus, musicNote:Tick.moveBody(note.musicNote)})),
        expiredNotes: [], gameEnd: (s.automaticNotes.length === 1 && s.userNotes.length === 0 && s.onscreenNotes.length === 0),
        keyPressed: "", keyReleased: "",
        time: this.timeElapsed,
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

    static noteManagement = (s: State): State => {
        const newUserNotes = s.userNotes.filter((note) => between(note.start - s.time + s.lastResetTime- 2, -(Constants.TICK_RATE_MS * 2)/1000 - 2, Constants.TICK_RATE_MS * 2/1000))
        const newShortNoteBodies = newUserNotes.filter((note) => (note.end - note.start) < 1).map(
            (note, i) => createSmallNote({id: (s.totalNotes + i).toString(), createTime: (s.time + s.lastResetTime)})
            (calcNoteStartingPos(note)(s.time - s.lastResetTime))(note)(new Vec(0, 175))).map((body) => ({playStatus: "ready", musicNote: body}))

        const numberOfNewObjects = newShortNoteBodies.length


        const newLongNoteBodies = newUserNotes.filter((note) => (note.end - note.start) >= 1).map(
            (note, i) => createLongNote({id: (s.totalNotes + i + numberOfNewObjects).toString(), createTime: (s.time - s.lastResetTime)})
            (calcNoteStartingPos(note)(s.time - s.lastResetTime))(note)(new Vec(0, 175))).map((body) => ({playStatus: "ready", musicNote: body}))

        const expiredNotes = s.onscreenNotes.filter((note) => (s.time - s.lastResetTime) > note.musicNote.note.end)
        const playedNotes = s.onscreenNotes.filter((note) =>
            (((note.musicNote.note.end - note.musicNote.note.start) < 1 && note.playStatus === "pressed") || note.playStatus === "released"))
        const readyAutomaticNotes = s.automaticNotes.filter((note) =>
            note.playStatus === "ready" && note.note.start <= (s.time - s.lastResetTime))

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
        const playableNotesInColumn = notesInColumn.filter((note) => between(note.musicNote.note.start - (s.time - s.lastResetTime), -0.2, 0.2))
        const unplayableNotesInColumn = cut(s.onscreenNotes)(playableNotesInColumn)


        return ({
            ...s,
            onscreenNotes: unplayableNotesInColumn.concat(playableNotesInColumn.map((note) => ({playStatus: "pressed", musicNote: note.musicNote}))),
            keyPressed: (playableNotesInColumn.length === 0 ? (notesInColumn.length === 0 ? "random" : this.keyColour) : ""),
            notesPlayed: s.notesPlayed + playableNotesInColumn.filter((note) => (note.musicNote.note.end - note.musicNote.note.start) < 1).length,
            score: s.score + (playableNotesInColumn.filter((note) => (note.musicNote.note.end - note.musicNote.note.start) < 1).length)*s.multiplier,
            simultaneousNotes: playableNotesInColumn.length === 0 ? 0 : (s.simultaneousNotes + playableNotesInColumn.length)
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
        const correctlyReleasedLongNotes = releasedLongNotes.filter((longnote) => between(longnote.musicNote.note.end - (s.time - s.lastResetTime), -0.1, 0.1))

        return ({
            ...s, score: s.score + (correctlyReleasedLongNotes.length)*s.multiplier,
            expiredNotes: releasedLongNotes.map((note) => ({playStatus: "released", musicNote: note.musicNote})),
            simultaneousNotes: correctlyReleasedLongNotes.length === 0 ? 0 : (s.simultaneousNotes + correctlyReleasedLongNotes.length)
        })

    }
}


class switchSong implements Action {
    constructor (public readonly switchDirection: SongSwitchWays, readonly csvContents: string[]) {}

    apply = (s: State): State => ({
        ...s,
        gameEnd: false,
        multiplier: 1,
        score: 0,
        highscore: s.highscore,
        time: 0,
        userNotes: loadSong(((this.switchDirection === "next" ? (s.currentSongIndex + 1) % Constants.SONG_NAME.length
            : (s.currentSongIndex - 1) % Constants.SONG_NAME.length)), this.csvContents).filter((note) => note.userPlayed),
        keyPressed: "",
        keyReleased: "",
        onscreenNotes: [],
        expiredNotes: [],
        automaticNotes: loadSong(((this.switchDirection === "next" ? (s.currentSongIndex + 1) % Constants.SONG_NAME.length
            : (s.currentSongIndex - 1) % Constants.SONG_NAME.length)), this.csvContents).filter((note) =>
            !note.userPlayed).map((note) => ({playStatus: "ready", note: note})),
        notesPlayed: 0,
        notesMissed: 0,
        totalNotes: 0,
        simultaneousNotes: 0,
        lastResetTime: s.time,
        currentSongIndex: this.switchDirection === "next" ? (s.currentSongIndex + 1) % Constants.SONG_NAME.length
            : (s.currentSongIndex - 1) % Constants.SONG_NAME.length,
        resetCanvas: true
    })
}

class restartSong implements Action {
    constructor(public readonly csvContents: string[]) {
    }

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
        lastResetTime: s.time,
        resetCanvas: true
    })
}

const reduceState = (action: Action, state: State) => action.apply(state);
