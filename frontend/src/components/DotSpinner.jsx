export function DotSpinner() {
  return (
    <div className="dot-spinner" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => <div className="dot-spinner__dot" key={index}></div>)}
    </div>
  );
}
