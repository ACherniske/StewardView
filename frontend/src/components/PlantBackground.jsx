import { useEffect, useRef } from 'react';
import '../styles/PlantBackground.css';

function PlantBackground() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Store plant parameters for consistent randomness
  const plantParamsRef = useRef([]);
  // Store per-plant runtime state
  const plantStatesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Set canvas size and regenerate plant params (account for DPR)
    const numPlants = 5;
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      // CSS size
      const cssWidth = window.innerWidth;
      const cssHeight = window.innerHeight;
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
      // Backing store size for crisp rendering
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Generate random params for each plant (positions in CSS pixels)
      plantParamsRef.current = Array.from({ length: numPlants }, () => ({
        x: Math.random() * (cssWidth * 0.8) + cssWidth * 0.1,
        maxGeneration: Math.floor(Math.random() * 2) + 5, // 5 or 6
        angle: Math.random() * 10 + 18, // 18-28 deg, dainty
        len: Math.random() * 2 + 3 // 3-5 px, thin
      }));

      // Reset plant states so growth runs again on resize
      plantStatesRef.current = plantParamsRef.current.map(() => ({
        word: 'X',
        currGeneration: 0,
        growthPercent: 0,
        done: false
      }));
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // L-System rules
    const rules = {
      X: [
        { rule: "(F[+X][-X]FX)", prob: 0.5 },
        { rule: "(F[-X]FX)", prob: 0.05 },
        { rule: "(F[+X]FX)", prob: 0.05 },
        { rule: "(F[++X][-X]FX)", prob: 0.1 },
        { rule: "(F[+X][--X]FX)", prob: 0.1 },
        { rule: "(F[+X][-X]FXA)", prob: 0.1 },
        { rule: "(F[+X][-X]FXB)", prob: 0.1 }
      ],
      F: [
        { rule: "F(F)", prob: 0.85 },
        { rule: "F(FF)", prob: 0.05 },
        { rule: "F", prob: 0.1 }
      ],
      "(": "",
      ")": ""
    };


    // These will be per-plant now
    // let word = "X";
    // const maxGeneration = 6;
    // let currGeneration = 0;
    // let growthPercent = 1;
    // const growthRate = 0.04;

    // Generate next generation
    function generate(word) {
      let next = "";
      for (let i = 0; i < word.length; i++) {
        let c = word[i];
        if (c in rules) {
          let rule = rules[c];
          if (Array.isArray(rule)) {
            next += chooseOne(rule);
          } else {
            next += rules[c];
          }
        } else {
          next += c;
        }
      }
      return next;
    }

    function chooseOne(ruleSet) {
      let n = Math.random();
      let t = 0;
      for (let i = 0; i < ruleSet.length; i++) {
        t += ruleSet[i].prob;
        if (t > n) {
          return ruleSet[i].rule;
        }
      }
      return "";
    }

    function nextGeneration() {
      if (growthPercent < 1) return;

      if (currGeneration === maxGeneration) {
        currGeneration = 0;
        word = "X";
      }

      word = generate(word);
      currGeneration++;
      growthPercent = 0;
    }

    // Drawing function with lerp

    function drawLsysLerp(x, y, state, t, len, ang) {
      t = Math.max(0, Math.min(1, t));
      let lerpOn = false;
      ctx.save();
      ctx.translate(x, y);
      for (let i = 0; i < state.length; i++) {
        let c = state[i];
        if (c === "(") { lerpOn = true; continue; }
        if (c === ")") { lerpOn = false; continue; }
        let lerpT = lerpOn ? t : 1;
        if (c === "A") {
          ctx.save();
          ctx.fillStyle = "rgba(139, 195, 74, 0.6)";
          ctx.beginPath();
          ctx.arc(0, 0, len * 2 * lerpT, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (c === "B") {
          ctx.save();
          ctx.fillStyle = "rgba(255, 183, 77, 0.6)";
          ctx.beginPath();
          ctx.arc(0, 0, len * 2 * lerpT, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (c === "F") {
          ctx.save();
          ctx.strokeStyle = "#4caf50";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -len * lerpT);
          ctx.stroke();
          ctx.translate(0, -len * lerpT);
          ctx.restore();
          ctx.translate(0, -len * lerpT);
        } else if (c === "+") {
          ctx.rotate((Math.PI / 180) * -ang * lerpT);
        } else if (c === "-") {
          ctx.rotate((Math.PI / 180) * ang * lerpT);
        } else if (c === "[") {
          ctx.save();
        } else if (c === "]") {
          ctx.restore();
        }
      }
      ctx.restore();
    }


    // plantStatesRef initialized in resizeCanvas; ensure non-empty
    if (!plantStatesRef.current || !plantStatesRef.current.length) {
      plantStatesRef.current = plantParamsRef.current.map(() => ({
        word: 'X',
        currGeneration: 0,
        growthPercent: 0,
        done: false
      }));
    }

    // Animation loop: grow each plant once, animate only growth
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      plantParamsRef.current.forEach((param, i) => {
        let state = plantStatesRef.current[i];
        if (!state.done) {
          if (state.growthPercent < 1) {
            state.growthPercent += 0.025;
          } else if (state.currGeneration < param.maxGeneration) {
            state.word = generate(state.word);
            state.currGeneration++;
            state.growthPercent = 0;
          } else {
            state.done = true;
            state.growthPercent = 1;
          }
        }
        drawLsysLerp(
          param.x,
          // convert CSS pixels for vertical placement
          (canvas.height / (window.devicePixelRatio || 1)) - 20,
          state.word,
          state.growthPercent,
          param.len,
          param.angle
        );
      });
      animationRef.current = requestAnimationFrame(animate);
    }

    animate();


    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="plant-background" />;
}

export default PlantBackground;