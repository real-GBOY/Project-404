/** HotelOS wordmark: the indigo tile + name, as in the design's sidebar header. */
export function Brand() {
  return (
    <div className="flex items-center gap-[9px]">
      <div className="size-[26px] rounded-[7px] bg-primary" aria-hidden="true" />
      <div className="text-[16px] font-extrabold tracking-[-0.01em]">HotelOS</div>
    </div>
  );
}
