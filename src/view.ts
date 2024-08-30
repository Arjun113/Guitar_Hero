// Canvas elements
import { State, Body, KeyColour, NoteStatusItem } from "./types.ts";
import {
    attr,
    between, filterForColour,
    isNotNullOrUndefined, mod,
    noteViewTypes,
    playNotes,
    releaseNotes,
    threeRNGSubject$,
} from "./util.ts";
import * as Tone from "tone";
import {take} from "rxjs";
import { Constants } from "./main.ts";
export { updateView }

/**
 * Makes an SVG element visible and brings it to the foreground of the canvas.
 * @param elem - The SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
    elem.setAttribute("visibility", "visible");
    elem.parentNode!.appendChild(elem);
};

/**
 * Hides an SVG element by setting its visibility to hidden.
 * @param elem - The SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
    elem.setAttribute("visibility", "hidden");

/**
 * Updates the view of the game based on the current state.
 * @param onFinish - Callback function to be called when the game ends
 * @param svg - The SVG element to update
 * @returns A function that takes the current game state and updates the view accordingly
 */
function updateView(onFinish: () => void) {
    return function(s: State) {
        // Get references to text fields for displaying game data
        const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement & HTMLElement;
        const gameover = document.querySelector("#gameOver") as SVGGraphicsElement & HTMLElement;
        const multiplier = document.querySelector("#multiplierText") as HTMLElement;
        const scoreText = document.querySelector("#scoreText") as HTMLElement;
        const highScoreText = document.querySelector("#highScoreText") as HTMLElement;

        /**
         * Updates the visual representation of a body (note) on the SVG canvas.
         * @param rootSVG - The root SVG element where the body is drawn
         * @returns A function that updates or creates the SVG elements for a given body
         */
        const updateBodyView = (rootSVG: HTMLElement) => (b: Body) => {
            /**
             * Creates a small circle SVG element for the body.
             * @returns The created SVG circle element
             */
            function createBodySmallView() {
                const v = document.createElementNS(rootSVG.namespaceURI, "circle") as SVGGraphicsElement;
                attr(v, { id: b.id, r: b.svgElems.circle.radius });
                v.classList.add(b.svgElems.circle.colour + b.viewType);
                rootSVG.appendChild(v);
                return v;
            }

            /**
             * Creates a large line SVG element for the body (note tail).
             * @returns The created SVG line element
             */
            function createBodyLargeView() {
                const t = document.createElementNS(rootSVG.namespaceURI, "line") as SVGGraphicsElement;
                attr(t, { id: b.id + "Tail" });
                t.classList.add(b.svgElems.tail.colour + b.viewType + "Tail");
                rootSVG.appendChild(t);
                return t;
            }

            // Get or create the SVG elements for the body
            const v = document.getElementById(b.id) || createBodySmallView();
            attr(v, { cx: b.svgElems.circle.pos.x, cy: b.svgElems.circle.pos.y });

            if ((b.note.end - b.note.start) >= 1) {
                const t = document.getElementById(b.id + "Tail") || createBodyLargeView();
                attr(t, {
                    x1: b.svgElems.tail.pos.x,
                    x2: b.svgElems.tail.pos.x,
                    y2: b.svgElems.tail.pos.y,
                    y1: b.svgElems.tail.pos.y - b.svgElems.tail.length
                });
            }
        };

        // If the SVG element is not available, exit early
        if (!svg) {
            return;
        }

        // Clear the canvas if resetCanvas is true
        if (s.resetCanvas) {
            noteViewTypes.forEach((noteClass) => {
                const elems = svg.querySelectorAll("." + noteClass);
                elems.forEach((body) => svg.removeChild(body));
            });
        }

        // Update text fields with the current score, multiplier, and highscore
        if (scoreText) {
            scoreText.innerText = s.score.toString();
        }

        if (multiplier) {
            multiplier.innerText = s.multiplier.toString() + "x";
        }

        if (highScoreText) {
            highScoreText.innerText = s.highscore.toString();
        }

        // Play notes that are marked as pressed
        s.automaticNotes.forEach((note) => {
            if (note.playStatus === "pressed") {
                playNotes(note.note)(s.samples, true);
            }
        });

        // Update the visual representation of onscreen notes
        s.onscreenNotes.forEach((body) => updateBodyView(svg)(body.musicNote));

        // Handle random note generation based on key pressed
        if (s.keyPressed === "random") {
            threeRNGSubject$.pipe(take(1)).subscribe(
                (randomNum) => s.samples["piano"].triggerAttackRelease(
                    Tone.Frequency(Math.floor(randomNum[0] * 83 + 24), "midi").toNote(),
                    randomNum[1],
                    undefined,
                    randomNum[2]
                )
            );
        }
        else if (s.keyPressed !== "") {

            // Get the nearest note from whatever's in the column whose key is pressed
            const nearestNote = s.onscreenNotes.filter((note) =>
                                                                filterForColour(note.musicNote.note, s.keyPressed)).reduce(
                (acc, val) =>
                    (s.time - acc.musicNote.note.start) < (s.time - val.musicNote.note.start) ? val : acc,
                s.onscreenNotes.filter((note) =>
                    filterForColour(note.musicNote.note, s.keyPressed))[0])

            // Play the nearest note for some random time
            threeRNGSubject$.pipe(take(1)).subscribe(
                (randomNum) => s.samples[nearestNote.musicNote.note.instrument].triggerAttackRelease(
                    Tone.Frequency(nearestNote.musicNote.note.pitch, "midi").toNote(),
                    randomNum[0],
                    undefined,
                    nearestNote.musicNote.note.velocity / 127
                )
            );
        }

        // Play notes that are marked as pressed and have a short duration OR long notes which are within 1 tick of the start time ONLY ONCE
        s.onscreenNotes.filter((note) => (note.playStatus === "pressed" &&
                note.musicNote.note.end - note.musicNote.note.start < 1) ||
            (note.playStatus === "pressed" && note.musicNote.note.end - note.musicNote.note.start >= 1
                && between(s.time - note.musicNote.note.start, 0, Constants.TICK_RATE_MS/1000)))
            .forEach((note) => playNotes(note.musicNote.note)(s.samples, true));

        // Release notes that are marked as released
        s.expiredNotes.filter((note) => note.playStatus === "released")
            .forEach((note) => releaseNotes(note.musicNote.note)(s.samples));

        // Remove expired notes from the canvas
        s.expiredNotes.map(o => document.getElementById(o.musicNote.id))
            .filter(isNotNullOrUndefined)
            .forEach(v => {
                try {
                    svg.removeChild(v);
                } catch (e) {
                    // Handle notes that may have already been removed
                    console.log("Already removed: " + v.id);
                }
            });

        // The tails need to go too!
        s.expiredNotes.map(o => document.getElementById(o.musicNote.id + "Tail"))
            .filter(isNotNullOrUndefined)
            .forEach(v => {
                try {
                    svg.removeChild(v);
                } catch (e) {
                    console.log("Already removed: " + v.id);
                }
            });

        // Display game over screen if the game has ended
        if (s.gameEnd) {
            show(gameover);
            onFinish();
        }
    };
}
