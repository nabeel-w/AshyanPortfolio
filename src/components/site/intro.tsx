import { IntroController } from "./intro-controller";

/**
 * CUTLINE-inspired opening "edit" (docs/01 → Intro). Home page only, once per session, ~1.5 s,
 * skippable. It's in the server HTML so there is no flash; the sequence is pure CSS (globals.css
 * `.intro*`). The inline script runs before the overlay paints and marks a repeat visit as "seen".
 * The hero image (LCP) paints underneath the whole time.
 */
const decideOnLoad = `try{var d=document.documentElement;if(sessionStorage.getItem("az-intro")){d.dataset.intro="seen"}else{sessionStorage.setItem("az-intro","1");d.dataset.intro="play"}}catch(e){document.documentElement.dataset.intro="seen"}`;

// Clip widths for the fake NLE timeline backdrop (video, video, audio, audio tracks).
const TRACKS: { audio?: boolean; clips: number[] }[] = [
  { clips: [3, 1.2, 2.4, 0.8, 3.6, 1.5, 2.2] },
  { clips: [1.4, 2.8, 1, 3.1, 0.7, 2.6, 1.9] },
  { audio: true, clips: [4.2, 2.1, 3.9, 1.8] },
  { audio: true, clips: [2.5, 3.3, 1.2, 4.4] },
];

export function Intro({ name }: { name: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: decideOnLoad }} />
      <div className="intro" aria-hidden data-intro-overlay>
        <div className="intro-stage">
          <div className="intro-backdrop">
            {TRACKS.map((t, i) => (
              <div key={i} className={t.audio ? "intro-track audio" : "intro-track"}>
                {t.clips.map((w, j) => (
                  <span key={j} style={{ ["--w" as string]: w }} />
                ))}
              </div>
            ))}
          </div>
          <span className="intro-playhead" />
          <p className="intro-name">
            <span className="w">{first}</span>
            <span className="intro-cutline" />
            <span className="w italic">{rest.join(" ") || first}</span>
          </p>
          <p className="intro-role label">● Film Editor</p>
          <p className="intro-tc label">
            <span className="text-red">REC </span>
          </p>
        </div>
      </div>
      <IntroController />
    </>
  );
}
