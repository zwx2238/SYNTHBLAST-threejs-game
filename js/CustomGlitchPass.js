import { GlitchPass as ThreeGlitchPass } from "three/examples/jsm/postprocessing/GlitchPass.js";

// Preserve the game's event-driven trigger on top of Three.js's maintained pass.
class GlitchPass extends ThreeGlitchPass {
    trigger() {
        this._curF = 0;
        this._randX = 1;
    }
}

export { GlitchPass };
