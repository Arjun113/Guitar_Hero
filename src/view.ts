// Canvas elements
import { Constants, Viewport } from "./main.ts";
import { State, Body, MusicNote, KeyColour, noteStatusItem } from "./types.ts";
import { attr, between, isNotNullOrUndefined, playNotes, randomnumber$ } from "./util.ts";
import * as Tone from "tone";
import { from, mergeMap, Observable, map, take } from "rxjs";
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


function updateView (onFinish: () => void, svg: SVGGraphicsElement & HTMLElement) {
    return function(s: State) {
        console.log(s.automaticNotes.filter((note) => note.playStatus === "pressed"))
        // Text fields
        const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
            HTMLElement;
        const multiplier = document.querySelector("#multiplierText") as HTMLElement;
        const scoreText = document.querySelector("#scoreText") as HTMLElement;
        const highScoreText = document.querySelector(
            "#highScoreText",
        ) as HTMLElement;

        const updateBodyView = (rootSVG: HTMLElement) => (b: Body) => {
            function createBodySmallView() {
                const v = document.createElementNS(rootSVG.namespaceURI, "circle") as SVGGraphicsElement;
                attr(v, { id: b.id, r: b.svgElems.circle.radius });
                v.classList.add(b.svgElems.circle.colour + b.viewType)
                rootSVG.appendChild(v)
                return v;
            }

            function createBodyLargeView() {
                const t = document.createElementNS(rootSVG.namespaceURI, "line") as SVGGraphicsElement;
                attr(t, { id: b.id + "Tail", x1: b.svgElems.tail.pos.x, x2: b.svgElems.tail.pos.x, y1: b.svgElems.tail.pos.y, y2: b.svgElems.tail.pos.y + b.svgElems.tail.length});
                t.classList.add(b.svgElems.tail.colour + b.viewType + "Tail")
                rootSVG.appendChild(t)
                return t;
            }

            const v = document.getElementById(b.id) || createBodySmallView();
            attr(v, {cx: b.svgElems.circle.pos.x, cy: b.svgElems.circle.pos.y});

            if ((b.note.end - b.note.start) >= 1) {
                const t = document.getElementById(b.id + "Tail") || createBodyLargeView()
            }
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

        s.automaticNotes.map((note) => {
            if (note.playStatus === "pressed") {
                playNotes(note.note)(s.samples, true)
            }
            }
        )

        s.onscreenNotes.forEach((body) => updateBodyView(svg)(body.musicNote));

        if (s.keyPressed === "random") {
            randomnumber$(101).pipe(take(1)).subscribe(
                (randomNum) => s.samples["piano"].triggerAttackRelease(
                    Tone.Frequency( Math.round(69 + 12 * Math.log2(randomNum * 127 / 440)), "midi").toNote(),
                    0.2,
                    undefined,
                    0.5
                )
            )
        }
        else if (s.keyPressed !== ""){
            const getNearestNote = (s: State) => (keyColour: KeyColour): ReadonlyArray<noteStatusItem> => {
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
                else return [] as ReadonlyArray<noteStatusItem>
            }

            const nearestNote = getNearestNote(s)(s.keyPressed).reduce(
                (acc, val) =>
                    (s.time - acc.musicNote.note.start) < (s.time - val.musicNote.note.start) ? val : acc, getNearestNote(s)(s.keyPressed)[0]
            )

            randomnumber$(101).pipe(take(1)).subscribe(
                (randomNum) => s.samples[nearestNote.musicNote.note.instrument].triggerAttackRelease(
                    Tone.Frequency(nearestNote.musicNote.note.pitch, "midi").toNote(),
                    randomNum,
                    undefined,
                    nearestNote.musicNote.note.velocity / 127
                ))
        }

        s.onscreenNotes.filter((note) => note.playStatus === "pressed").map((note) =>
            playNotes(note.musicNote.note)(s.samples, true)
        )


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

        s.expiredNotes.map(o => document.getElementById(o.musicNote.id + "Tail")).filter(
            isNotNullOrUndefined).forEach(v => {
                try {
                    svg.removeChild(v)
                } catch (e) {
                    console.log("Already removed: " + v.id)
                }
            }
        )

        if (s.gameEnd) {
            show(gameover);
            onFinish();
        }
    }

}

