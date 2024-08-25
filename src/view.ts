// Canvas elements
import { Viewport } from "./main.ts";
import { State, Body, MusicNote } from "./types.ts";
import { attr, between, isNotNullOrUndefined } from "./util.ts";
import * as Tone from "tone";
import { Observable } from "rxjs";
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


function updateView (onFinish: () => void) {
    return function(s: State) {
        console.log(s);
        const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
            HTMLElement;
        const preview = document.querySelector(
            "#svgPreview",
        ) as SVGGraphicsElement & HTMLElement;
        const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
            HTMLElement;
        const container = document.querySelector("#main") as HTMLElement;

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
            attr(v, { cx: b.pos.x, cy: b.pos.y });
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
            if (between(s.time, note.start, note.end)) {
                // Play note
            }
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

    const playNotes = (musicNote: MusicNote) => (samples: {
        [p: string]: Tone.Sampler
    }, isTriggeredOrNot: boolean, randomNumber?: number) => {
        if (isTriggeredOrNot) {
            samples[musicNote.instrument].triggerAttack(
                Tone.Frequency(musicNote.pitch, "midi").toNote(),
                (musicNote.end - musicNote.start),
                musicNote.velocity
            )
        } else {
            samples[musicNote.instrument].triggerAttack(
                Tone.Frequency(randomNumber, "midi").toNote(),
                (musicNote.end - musicNote.start),
                musicNote.velocity
            )
        }
    }

    const releaseNotes = (musicNote: MusicNote) => (samples: { [p: string]: Tone.Sampler }) => {
        samples[musicNote.instrument].triggerRelease(
            Tone.Frequency(musicNote.pitch, "midi").toNote()
        )
    }
}
