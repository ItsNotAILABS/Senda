export function FilmBand({ src, poster, label }: { src?: string; poster: string; label: string }) {
  return (
    <div className="senda-rise relative h-48 overflow-hidden rounded-[28px] border border-white/10">
      {src ? (
        <video src={src} poster={poster} autoPlay muted loop playsInline className="senda-film h-full w-full object-cover" />
      ) : (
        <img src={poster} alt="" className="senda-film h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <p className="absolute bottom-4 left-5 flex items-center gap-2 text-xs tracking-[0.18em] text-white/85 uppercase">
        <span className="senda-dot size-1.5 rounded-full bg-accent" />
        {label}
      </p>
    </div>
  );
}
