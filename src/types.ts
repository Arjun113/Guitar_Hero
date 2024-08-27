import { Vec } from "./util.ts";
import {Note } from "./main.ts";
import * as Tone from "tone";
import { Sampler } from "tone";

export type {Key, Event, MusicNote, State, ViewType, ObjectId, Circle, Body, ColourPos, noteStatusItem, SVGGroup, KeyColour, Tail, SongSwitchWays}
export type {Action}

/** User input */

type Key = "KeyH" | "KeyJ" | "KeyK" | "KeyL" | "ArrowLeft" | "ArrowRight";

type Event = "keydown" | "keyup" | "keypress";

type KeyColour = "green" | "red" | "blue" | "yellow" | "";

type SongSwitchWays = "previous" | "next"


type MusicNote = Readonly<{
    userPlayed: boolean,
    instrument: string,
    velocity: number,
    pitch: number,
    start: number,
    end: number
}>;

type State = Readonly<{
    gameEnd: boolean;
    notesPlayed: number,
    notesMissed: number
    multiplier: number,
    score: number,
    highscore: number,
    time: number,
    onscreenNotes: noteStatusItem[],
    expiredNotes: noteStatusItem[],
    keyPressed: KeyColour | "random",
    keyReleased: KeyColour | "random",
    userNotes: MusicNote[],
    automaticNotes: {playStatus: string, note: MusicNote}[],
    samples: { [p: string]: Sampler },
    totalNotes: number,
    simultaneousNotes: number,
    lastResetTime: number,
    currentSongIndex: number
}>;

type Circle = Readonly<{ pos: Vec, radius: number, colour: string }>

type Tail = Readonly<{
    width: number,
    length: number,
    pos: Vec,
    colour: string
}>

type SVGGroup = Readonly<{
    svgElems: {circle: Circle, tail: Tail}
}>

/**
 * ObjectIds help us identify objects and manage objects which timeout (such as bullets)
 */
type ObjectId = Readonly<{ id: string, createTime: number }>

/**
 * Every object that participates in physics is a Body
 */
type Body = SVGGroup & ObjectId & Readonly<{
    viewType: ViewType,
    vel: Vec,
    note: MusicNote
}>

type ViewType = "ShortNote" | "LongNote"

type ColourPos = [colour: string, yPositionPercentage: number]

/**
 * Actions modify state
 */
interface Action {
    apply(s: State): State;
}

type noteStatusItem = Readonly<{
    musicNote: Body,
    playStatus: string
}>