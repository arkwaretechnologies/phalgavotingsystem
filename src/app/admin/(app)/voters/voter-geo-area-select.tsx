import { VOTER_GEO_AREAS } from "@/lib/voters/geo-area";

const inputClass = "rounded-md border px-3 py-2";

type Props = {
  name?: string;
  defaultValue?: string;
  /** When true, empty option is invalid (HTML5 + server validation). Default true. */
  required?: boolean;
};

export function VoterGeoAreaSelect({ name = "geo_area", defaultValue = "", required = true }: Props) {
  return (
    <select name={name} className={inputClass} defaultValue={defaultValue} required={required}>
      <option value="" disabled={required}>
        {required ? "Select geo area…" : "—"}
      </option>
      {VOTER_GEO_AREAS.map((area) => (
        <option key={area} value={area}>
          {area}
        </option>
      ))}
    </select>
  );
}
