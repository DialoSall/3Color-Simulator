function HomeScreen({ onPlayLevels, onCustomGraph }) {
  return (
    <main className="app">
      <section className="hero homeHero">
        <p className="eyebrow">Graph Coloring Simulator</p>
        <h1>3Color</h1>

        <p className="heroText">
          Color graph vertices using red, blue, and yellow. Adjacent vertices
          cannot share the same color.
        </p>
      </section>

      <section className="homeGrid">
        <article className="modeCard" onClick={onPlayLevels}>
          <p className="eyebrow">Mode 1</p>
          <h2>Level Mode</h2>
          <p>
            Solve curated graph coloring puzzles that gradually become more
            difficult.
          </p>

          <button>Play Levels</button>
        </article>

        <article className="modeCard" onClick={onCustomGraph}>
          <p className="eyebrow">Mode 2</p>
          <h2>Custom Graph</h2>
          <p>
            Generate a random graph or build your own graph by placing vertices
            and connecting edges.
          </p>

          <button>Build Graph</button>
        </article>
      </section>
    </main>
  );
}

export default HomeScreen;