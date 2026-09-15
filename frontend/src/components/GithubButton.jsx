export default function GithubButton({ url = 'https://github.com/Prazdnic-Moscow' }) {
  return (
    <a
      className="github-btn"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      GitHub
    </a>
  );
}