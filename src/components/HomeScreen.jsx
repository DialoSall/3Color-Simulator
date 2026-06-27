import { useNavigate } from "react-router-dom";
import { useState } from "react";

const GAME_URL = "https://3color.app/";

function HomeScreen() {
  const navigate = useNavigate();
  const [shareMessage, setShareMessage] = useState("");

  
  async function copyLinkToClipboard() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(GAME_URL);
        return true;
      }

      const textArea = document.createElement("textarea");
      textArea.value = GAME_URL;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      textArea.style.fontSize = "16px";

      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, textArea.value.length);

      const copied = document.execCommand("copy");

      document.body.removeChild(textArea);

      return copied;
    } catch {
      return false;
    }
  }

  async function handleShare() {
    const shareData = {
      title: "3Color",
      text: "Can you complete all 30 levels of this graph-coloring puzzle?",
      url: GAME_URL,
    };

    try {
      if (navigator.share && window.isSecureContext) {
        await navigator.share(shareData);
        setShareMessage("Thanks for sharing!");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }

    const copied = await copyLinkToClipboard();

    if (copied) {
      setShareMessage("Link copied!");
    } else {
      setShareMessage(`Copy this link: ${GAME_URL}`);
    }
  }

  return (
    <main className="app homeApp">
      <section className="homeChallenge">
        <div className="homeCopy">
          <p className="eyebrow">Graph Coloring Puzzle</p>

          <h1>3Color</h1>

          <p className="homeChallengeText">
            Can you complete all 30 levels?
          </p>

          <p className="heroText">
            Color every circle using red, blue, and yellow. Circles
            connected by a line cannot have the same color. The rules are
            simple. The puzzles get harder.
          </p>

          <div className="homeStats">
            <span>30 Levels</span>
            <span>3 Colors</span>
            <span>No Matching Lines</span>
          </div>

          <div className="homeActions">
            <button
              className="primaryHomeButton"
              onClick={() => navigate("/levels/1")}
            >
              Start Challenge
            </button>

            <button className="shareHomeButton" onClick={handleShare}>
              Share 3Color
            </button>

            <button
              className="secondaryHomeButton"
              onClick={() => navigate("/custom")}
            >
              Generate Random Puzzle
            </button>
          </div>

          {shareMessage && (
            <p className="shareMessage">{shareMessage}</p>
          )}
        </div>

        <div className="homePreviewCard" aria-hidden="true">
          <div className="previewGraph">
            <svg viewBox="0 0 420 320" className="previewSvg">
              <line x1="210" y1="55" x2="85" y2="245" />
              <line x1="210" y1="55" x2="335" y2="245" />
              <line x1="85" y1="245" x2="335" y2="245" />
              <line x1="85" y1="245" x2="210" y2="180" />
              <line x1="335" y1="245" x2="210" y2="180" />

              <circle cx="210" cy="55" r="28" className="previewRed" />
              <circle cx="85" cy="245" r="28" className="previewBlue" />
              <circle cx="335" cy="245" r="28" className="previewYellow" />
              <circle cx="210" cy="180" r="28" className="previewRed" />
            </svg>
          </div>

          <div className="previewCaption">
            <p>Simple rule.</p>
            <strong>Harder than it looks.</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HomeScreen;