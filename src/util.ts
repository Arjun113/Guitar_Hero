import { Circle, ColourPos, MusicNote, Body, noteStatusItem, SVGGroup, Tail } from "./types.ts";
import { Note, Viewport } from "./main.ts";
import * as Tone from "tone";
import { Sampler } from "tone";
import { interval } from "rxjs";
import { map, scan } from "rxjs/operators";
export {Vec, attr, calcNoteStartingPos, except, isNotNullOrUndefined, not, between, RNG, playNotes, releaseNotes, cut, randomnumber$, noteViewTypes}

/**
 * A random number generator which provides two pure functions
 * `hash` and `scaleToRange`.  Call `hash` repeatedly to generate the
 * sequence of hashes.
 */
abstract class RNG {
    // LCG using GCC's constants
    private static m = 0x80000000; // 2**31
    private static a = 1103515245;
    private static c = 12345;

    /**
     * Call `hash` repeatedly to generate the sequence of hashes.
     * @param seed
     * @returns a hash of the seed
     */
    public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

    /**
     h    * Takes hash value and scales it to the range [0, 1]
     */
    public static scale = (hash: number) => (2 * hash) / (RNG.m - 1) /2;
}

/**
 * A simple immutable vector class
 */
class Vec {
    constructor(public readonly x: number = 0, public readonly y: number = 0) {
    }

    add = (b: Vec) => new Vec(this.x + b.x, this.y + b.y)
    sub = (b: Vec) => this.add(b.scale(-1))
    scale = (s: number) => new Vec(this.x * s, this.y * s)
    static Zero = new Vec()
}

const
    /**
     * Composable not: invert boolean result of given function
     * @param f a function returning boolean
     * @param x the value that will be tested with f
     */
    not = <T>(f: (x: T) => boolean) => (x: T) => !f(x),
    /**
     * is e an element of a using the eq function to test equality?
     * @param eq equality test function for two Ts
     * @param a an array that will be searched
     * @param e an element to search a for
     */
    elem =
        <T>(eq: (_: T) => (_: T) => boolean) =>
            (a: ReadonlyArray<T>) =>
                (e: T) => a.findIndex(eq(e)) >= 0,
    /**
     * array a except anything in b
     * @param eq equality test function for two Ts
     * @param a array to be filtered
     * @param b array of elements to be filtered out of a
     */
    except =
        <T>(eq: (_: T) => (_: T) => boolean) =>
            (a: ReadonlyArray<T>) =>
                (b: ReadonlyArray<T>) => a.filter(not(elem(eq)(b))),
    /**
     * set a number of attributes on an Element at once
     * @param e the Element
     * @param o a property bag
     */
    attr = (e: Element, o: { [p: string]: unknown }) => { for (const k in o) e.setAttribute(k, String(o[k])) }
/**
 * Type guard for use in filters
 * @param input something that might be null or undefined
 */
function isNotNullOrUndefined<T extends object>(input: null | undefined | T): input is T {
    return input != null;
}


const calcNoteStartingPos = (note: MusicNote) => (time: number): SVGGroup => {
    function calcPercentage(note: MusicNote): ColourPos {
        if (note.pitch < 32 && note.pitch >= 0) {
            return ["green", 0.2];
        }
        else if (note.pitch < 64 && note.pitch >= 32) {
            return ["red", 0.4];
        }
        else if (note.pitch < 96 && note.pitch >= 64) {
            return ["blue", 0.6];
        }
        else {
            return ["yellow", 0.8];
        }
    }

    function createSVGGroup (note: MusicNote, colourPos: ColourPos, time: number): SVGGroup {
        const circle = {pos: new Vec(colourPos[1] * Viewport.CANVAS_WIDTH, (note.start - time) * 175 - 350),
                                                    radius: Note.RADIUS, colour: colourPos[0]}
        const line = {pos: new Vec(colourPos[1] * Viewport.CANVAS_WIDTH, (note.start - time) * 175 - 350),
                                                    width: Note.TAIL_WIDTH, length: (note.end - note.start) * 175,
                                                    colour: colourPos[0]}

        return {svgElems: {circle: circle, tail: line}}
    }

    const colourPos = calcPercentage(note);
    return createSVGGroup(note, colourPos, time)
}

const between = (x: number, min: number, max: number) => {
    return x >= min && x < max;
}

const playNotes = (musicNote: MusicNote) => (samples: {
    [p: string]: Tone.Sampler
}, isTriggeredOrNot: boolean, randomNumber?: number) => {
    if (isTriggeredOrNot) {
        samples[musicNote.instrument].triggerAttackRelease(
            Tone.Frequency(musicNote.pitch, "midi").toNote(),
            (musicNote.end - musicNote.start),
            undefined,
            musicNote.velocity / 127
        )
    } else if (!isTriggeredOrNot && randomNumber !== undefined) {
        samples[musicNote.instrument].triggerAttackRelease(
            Tone.Frequency(randomNumber, "midi").toNote(),
            randomNumber,
            undefined,
            musicNote.velocity / 127
        )
    }
}


const releaseNotes = (musicNote: MusicNote) => (samples: { [p: string]: Sampler }) => {
    samples[musicNote.instrument].triggerRelease(
        Tone.Frequency(musicNote.pitch, "midi").toNote()
    )
}

const cut = except((a: noteStatusItem) => (b: noteStatusItem) => a.musicNote.id === b.musicNote.id)


/** Random numbers for playback **/
const randomnumber$ = (seed: number) => interval(10 as number).pipe(
    scan((acc, val) => RNG.hash(val), seed),
    map((randnum) => RNG.scale(randnum))
)


const noteViewTypes = ["redShortNote", "redLongNote", "blueShortNote", "blueLongNote", "yellowShortNote", "yellowLongNote",
    "greenShortNote", "greenLongNote", "greenLongNoteTail", "redLongNoteTail", "yellowLongNoteTail", "blueLongNoteTail"]