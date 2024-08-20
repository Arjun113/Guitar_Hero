// Canvas elements
import { Viewport } from "./main.ts";
import { State } from "./types.ts";

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



    }
}

