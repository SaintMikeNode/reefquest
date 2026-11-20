import { useT } from "../i18n";
import { levelFor } from "../lib/alert";

/** NOAA alert level as a color square + words (the figure-key style used across the site). */
export function AlertChip({ dhw }: { dhw: number }) {
  const t = useT();
  const lv = levelFor(dhw);
  return (
    <span className="alert" title={t(`alert.${lv.key}.desc`)}>
      <i style={{ background: lv.color }} />
      {t(`alert.${lv.key}`)}
    </span>
  );
}
