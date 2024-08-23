// Canvas elements
import { Viewport } from "./main.ts";
import { State, Body } from "./types.ts";
import { attr, isNotNullOrUndefined } from "./util.ts";

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

const updateBodyView = (rootSVG: HTMLElement) => (b: Body) => {
    function createBodyView() {
        const v = document.createElementNS(rootSVG.namespaceURI, "ellipse");
        attr(v, { id: b.id, rx: b.radius, ry: b.radius });
        v.classList.add(b.viewType)
        rootSVG.appendChild(v)
        return v;
    }
    const v = document.getElementById(b.id) || createBodyView();
    attr(v, { cx: b.pos.x, cy: b.pos.y });
};


function updateView (onFinish: () => void) {
    return function (s: State) {
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

        if (!svg) {
            return
        }

        if(scoreText) {
            scoreText.innerText = s.score.toString();
        }

        if (multiplier) {
            multiplier.innerText = s.multiplier.toString();
        }

        if (highScoreText) {
            highScoreText.innerText = s.highscore.toString();
        }

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

        if(s.gameEnd) {
            show(gameover);
        }

    }
}

