import { Circle, ColourPos, MusicNote, Body, noteStatusItem, SVGGroup, Tail } from "./types.ts";
import { Note, Viewport } from "./main.ts";
import * as Tone from "tone";
import { Sampler } from "tone";
import { interval, Observable, shareReplay, Subject, zip, zipWith } from "rxjs";
import { map, scan } from "rxjs/operators";
export { Vec, attr, calcNoteStartingPos, except, isNotNullOrUndefined, not, between, RNG, playNotes, releaseNotes, cut,
    threeRNGStream$, threeRNGSubject$, noteViewTypes }

/**
 * A random number generator (RNG) using a Linear Congruential Generator (LCG) algorithm.
 * Provides functions to generate and scale random numbers.
 */
abstract class RNG {
    private static m = 0x80000000; // 2^31, modulus value for the LCG
    private static a = 1103515245; // multiplier for the LCG
    private static c = 12345; // increment for the LCG

    /**
     * Generates a hash from a seed value using the LCG algorithm.
     * @param seed - The initial seed value for the hash
     * @returns A hashed value based on the seed
     */
    public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

    /**
     * Scales a hash value to the range [0, 1].
     * @param hash - The hash value to scale
     * @returns A scaled value between 0 and 1
     */
    public static scale = (hash: number) => (2 * hash) / (RNG.m - 1) / 2;
}

/**
 * A simple immutable vector class representing a 2D point or vector.
 */
class Vec {
    constructor(public readonly x: number = 0, public readonly y: number = 0) {}

    /**
     * Adds another vector to this vector.
     * @param b - The vector to add
     * @returns A new vector representing the sum
     */
    add = (b: Vec) => new Vec(this.x + b.x, this.y + b.y);

    /**
     * Subtracts another vector from this vector.
     * @param b - The vector to subtract
     * @returns A new vector representing the difference
     */
    sub = (b: Vec) => this.add(b.scale(-1));

    /**
     * Scales this vector by a given factor.
     * @param s - The scaling factor
     * @returns A new vector scaled by the factor
     */
    scale = (s: number) => new Vec(this.x * s, this.y * s);

    // A zero vector (0, 0)
    static Zero = new Vec();
}

/**
 * Inverts the boolean result of a given function.
 * @param f - A function that returns a boolean value
 * @returns A function that returns the inverse boolean result
 */
const not = <T>(f: (x: T) => boolean) => (x: T) => !f(x);

/**
 * Checks if an element is present in an array using the provided equality function.
 * @param eq - A function that tests equality between two elements
 * @param a - The array to search
 * @param e - The element to find
 * @returns True if the element is in the array, otherwise false
 */
const elem = <T>(eq: (_: T) => (_: T) => boolean) => (a: ReadonlyArray<T>) => (e: T) => a.findIndex(eq(e)) >= 0;

/**
 * Filters elements from an array that are present in another array.
 * @param eq - A function that tests equality between two elements
 * @param a - The array to be filtered
 * @param b - The array of elements to be removed from array a
 * @returns A new array with elements from a excluding those in b
 */
const except = <T>(eq: (_: T) => (_: T) => boolean) => (a: ReadonlyArray<T>) => (b: ReadonlyArray<T>) => a.filter(not(elem(eq)(b)));

/**
 * Sets multiple attributes on an HTML element at once.
 * @param e - The element to which attributes will be applied
 * @param o - An object where keys are attribute names and values are attribute values
 */
const attr = (e: Element, o: { [p: string]: unknown }) => { for (const k in o) e.setAttribute(k, String(o[k])); }

/**
 * Type guard to filter out null or undefined values.
 * @param input - The value to check
 * @returns True if the input is neither null nor undefined
 */
function isNotNullOrUndefined<T extends object>(input: null | undefined | T): input is T {
    return input != null;
}

/**
 * Calculates the starting position and SVG group of a music note based on its pitch and start time.
 * @param note - The music note to calculate the position for
 * @param time - The current time for positioning
 * @returns An SVGGroup representing the visual elements for the note
 */
const calcNoteStartingPos = (note: MusicNote) => (time: number): SVGGroup => {
    /**
     * Determines the color and position percentage based on the note's pitch.
     * @param note - The music note to determine color and position
     * @returns A tuple with color and position percentage
     */
    function calcPercentage(note: MusicNote): ColourPos {
        if (note.pitch < 32 && note.pitch >= 0) {
            return ["green", 0.2];
        } else if (note.pitch < 64 && note.pitch >= 32) {
            return ["red", 0.4];
        } else if (note.pitch < 96 && note.pitch >= 64) {
            return ["blue", 0.6];
        } else {
            return ["yellow", 0.8];
        }
    }

    /**
     * Creates an SVG group with circle and line elements for the note.
     * @param note - The music note to create SVG elements for
     * @param colourPos - The color and position of the note
     * @param time - The current time for positioning
     * @returns An SVGGroup representing the note
     */
    function createSVGGroup(note: MusicNote, colourPos: ColourPos, time: number): SVGGroup {
        const circle = {
            pos: new Vec(colourPos[1] * Viewport.CANVAS_WIDTH,  350 - (note.start - time) * 175),
            radius: Note.RADIUS,
            colour: colourPos[0]
        };
        const line = {
            pos: new Vec(colourPos[1] * Viewport.CANVAS_WIDTH, 350 - (note.start - time) * 175),
            width: Note.TAIL_WIDTH,
            length: (note.end - note.start) * 175,
            colour: colourPos[0]
        };

        return { svgElems: { circle: circle, tail: line } };
    }

    const colourPos = calcPercentage(note);
    return createSVGGroup(note, colourPos, time);
}

/**
 * Checks if a number is within a specified range.
 * @param x - The number to check
 * @param min - The minimum value of the range (inclusive)
 * @param max - The maximum value of the range (exclusive)
 * @returns True if x is within the range [min, max), otherwise false
 */
const between = (x: number, min: number, max: number) => {
    return x >= min && x < max;
}

/**
 * Plays a music note using the provided samples.
 * @param musicNote - The note to play
 * @param samples - A dictionary of sample instruments
 * @param isTriggeredOrNot - Flag to determine whether to use the note's pitch or a random number
 * @param randomNumber - Optional random number for note playback
 */
const playNotes = (musicNote: MusicNote) => (samples: { [p: string]: Tone.Sampler }, isTriggeredOrNot: boolean, randomNumber?: number) => {
    if (isTriggeredOrNot) {
        samples[musicNote.instrument].triggerAttackRelease(
            Tone.Frequency(musicNote.pitch, "midi").toNote(),
            (musicNote.end - musicNote.start),
            undefined,
            musicNote.velocity / 127
        );
    } else if (!isTriggeredOrNot && randomNumber !== undefined) {
        samples[musicNote.instrument].triggerAttackRelease(
            Tone.Frequency(randomNumber, "midi").toNote(),
            randomNumber,
            undefined,
            musicNote.velocity / 127
        );
    }
}

/**
 * Releases a music note using the provided samples.
 * @param musicNote - The note to release
 * @param samples - A dictionary of sample instruments
 */
const releaseNotes = (musicNote: MusicNote) => (samples: { [p: string]: Sampler }) => {
    samples[musicNote.instrument].triggerRelease(
        Tone.Frequency(musicNote.pitch, "midi").toNote()
    );
}

/**
 * Function to exclude noteStatusItems from an array based on their musicNote ID.
 * @param a - The first noteStatusItem
 * @param b - The second noteStatusItem to compare with
 * @returns True if the IDs are the same, otherwise false
 */
const cut = except((a: noteStatusItem) => (b: noteStatusItem) => a.musicNote.id === b.musicNote.id);

export function createRngStreamFromSource<T>(source$: Observable<T>) {
    return (seed: number = 0): Observable<number> => {
        return source$.pipe(
            scan(() => seed = RNG.hash(seed)),
            map(() => RNG.scale(RNG.hash(seed)))
        );
    };
}

// Zip together three observables to make different prime numbers
const rngStream = createRngStreamFromSource(interval(10));
// New Subject for the numbers. This is to ensure that the numbers are actually random.
// Because take(1) on plain Observables returns the same values every time.
// I am aware that Subjects are probably outside the unit scope, but I did not want to use Math.random()
const threeRNGSubject$ = new Subject<number[]>()
const threeRNGStream$ = zip(rngStream(101), rngStream(717), rngStream(817)).subscribe(threeRNGSubject$)

/**
 * List of note view types used for rendering notes in the SVG.
 */
const noteViewTypes = [
    "redShortNote", "redLongNote", "blueShortNote", "blueLongNote",
    "yellowShortNote", "yellowLongNote", "greenShortNote", "greenLongNote",
    "greenLongNoteTail", "redLongNoteTail", "yellowLongNoteTail", "blueLongNoteTail"
];
