import { useT } from "../i18n";
import { levelFor } from "../lib/alert";

export function AlertChip({ dhw }: { dhw: number }) {
  const t = useT();
  const lv = levelFor(dhw);
  return (
    <span className="chip" style={{ color: lv.color }} title={t(`alert.${lv.key}.desc`)}>
      <i />
      {t(`alert.${lv.key}`)}
    </span>
  );
}
