// Canvas elements
import { Constants, Viewport } from "./main.ts";
import { State, Body, MusicNote } from "./types.ts";
import { attr, between, isNotNullOrUndefined, playNotes } from "./util.ts";
import * as Tone from "tone";
import { from, mergeMap, Observable, map } from "rxjs";
export {updateView}

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
    elem.setAttribute("visibility", "visible");
    elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
    elem.setAttribute("visibility", "hidden");


function updateView (onFinish: () => void, rand$: Observable<number>, samples: {[p: string] : Tone.Sampler}, svg: SVGGraphicsElement & HTMLElement, gameover: SVGGraphicsElement) {
    return function(s: State) {
        // Text fields
        const multiplier = document.querySelector("#multiplierText") as HTMLElement;
        const scoreText = document.querySelector("#scoreText") as HTMLElement;
        const highScoreText = document.querySelector(
            "#highScoreText",
        ) as HTMLElement;

        const updateBodyView = (rootSVG: HTMLElement) => (b: Body) => {
            function createBodyView() {
                const v = document.createElementNS(rootSVG.namespaceURI, "circle") as SVGGraphicsElement;
                attr(v, { id: b.id, r: b.radius });
                v.classList.add(b.colour + b.viewType)
                rootSVG.appendChild(v)
                return v;
            }

            const v = document.getElementById(b.id) || createBodyView();
            attr(v, {cx: b.pos.x, cy: b.pos.y});
        };

        if (!svg) {
            return
        }

        if (scoreText) {
            scoreText.innerText = s.score.toString();
        }

        if (multiplier) {
            multiplier.innerText = s.multiplier.toString();
        }

        if (highScoreText) {
            highScoreText.innerText = s.highscore.toString();
        }

        s.notesAuto.forEach((note) => {
            playNotes(note)(samples, true);
        })

        s.shortNoteStatus.forEach((note) => updateBodyView(svg)(note.musicNote))
        s.longNoteStatus.forEach((note) => updateBodyView(svg)(note.musicNote))

        const playedNotes = (s.shortNoteStatus.filter((note) => note.playStatus === "played"))
            .concat(s.longNoteStatus.filter((note) => note.playStatus === "played"));

        const releasedNotes = s.longNoteStatus.filter((note) => note.playStatus === "dead");
        const ignoredNotes = (s.shortNoteStatus.filter((note) => note.playStatus === "ignored"))
            .concat(s.longNoteStatus.filter((note) => note.playStatus === "ignored"));

        // Play random notes for the ignored notes here.

        s.expiredNotes.map(o => document.getElementById(o.musicNote.id))
            .filter(isNotNullOrUndefined)
            .forEach(v => {
                try {
                    svg.removeChild(v)
                } catch (e) {
                    // Note may have expiring clashes.
                    console.log("Already removed: " + v.id)
                }
            })

        if (s.gameEnd) {
            show(gameover);
        }
    }

}

