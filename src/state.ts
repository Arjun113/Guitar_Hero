import { NoteBallAssociation, State } from "./types.ts";

const initialState: State = {
    gameEnd: false,
    noteBallAssociations: [] as NoteBallAssociation[],
    multiplier: 1,
    score: 0,
    highscore: 0
} as const;

