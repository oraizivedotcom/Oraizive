import { FEATURE_VIDEOS, FOLDER_CARDS } from "./landingMedia";

/**
 * Keeps the landing-page demos warm while the initial UI is rendering. The
 * videos also have `preload="auto"` on their elements so browsers that do not
 * honour video preload hints still request them without waiting for scroll.
 */
export default function LandingMediaPreloads() {
  const media = Array.from(
    new Map(
      [...FOLDER_CARDS, ...Object.values(FEATURE_VIDEOS)].map((item) => [
        item.video,
        item,
      ]),
    ).values(),
  );
  const posters = Array.from(new Set(media.map(({ poster }) => poster)));

  return (
    <>
      {media.map(({ video, poster }, index) => (
        <link
          key={video}
          rel="preload"
          as="video"
          href={video}
          type="video/mp4"
          fetchPriority={index === 0 ? "high" : "low"}
        />
      ))}
      {posters.map((poster) => (
        <link key={poster} rel="preload" as="image" href={poster} />
      ))}
    </>
  );
}
