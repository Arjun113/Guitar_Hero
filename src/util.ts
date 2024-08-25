import { Circle, ColourPos, MusicNote } from "./types.ts";
import { Note, Viewport } from "./main.ts";
export {Vec, attr, calcNoteStartingPos, except, isNotNullOrUndefined, not, between}

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
     h    * Takes hash value and scales it to the range [-1, 1]
     */
    public static scale = (hash: number) => (2 * hash) / (RNG.m - 1) - 1;
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


const calcNoteStartingPos = (note: MusicNote): Circle => {
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

    const colourPos = calcPercentage(note);
    return {pos: new Vec(Viewport.CANVAS_WIDTH * colourPos[1], 0), radius: Note.RADIUS, colour: colourPos[0]};
}

const between = (x: number, min: number, max: number) => {
    return x >= min && x < max;
}
