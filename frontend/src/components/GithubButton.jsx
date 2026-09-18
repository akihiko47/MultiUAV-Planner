export default function GithubButton({ url = 'https://github.com/akihiko47/MultiUAV-Planner' }) {
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