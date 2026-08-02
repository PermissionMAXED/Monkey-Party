class_name GoobyeAlwin
extends RefCounted
## Onkel Alwins Stammkunden-Ritual (Gag-Vertrag §6.3) — PURE + static:
## übersetzt den TAGES-SEED (injiziert, AGENTS-Regel „Zeit/Zufall immer
## injizieren“) in seine Tageszeile. Gleicher Tag = gleiche Zeile, DE und
## EN zeigen denselben Pool-Index (die Pools MÜSSEN gleich groß sein —
## Test wacht darüber). Zwei Stimmungen:
##   sprueche_moehre — die Möhre liegt im Regal (Kennerblick, zufrieden)
##   sprueche_leer   — leergefegtes Möhrenregal (Hängeohren, kein Kauf)

const SPRUECHE_MOEHRE := "dlc_goobye.alwin.sprueche_moehre"
const SPRUECHE_LEER := "dlc_goobye.alwin.sprueche_leer"


## Liegt Alwins tägliche Möhre im Bon? (Er kauft NIE etwas anderes.)
static func hat_moehre(bon: Dictionary) -> bool:
	for position: Dictionary in bon.get("positionen", []):
		if str(position.get("ware", "")) == GoobyeMarkttag.ALWIN_WARE:
			return true
	return false


## Deterministischer Pool-Index aus dem Tages-Seed (−1 bei leerem Pool).
static func spruch_index(seed_wert: int, groesse: int) -> int:
	if groesse <= 0:
		return -1
	return absi(seed_wert) % groesse


## Lokalisierte Tageszeile für Alwins Regal-Moment ("" nur bei leerem Pool).
static func spruch(seed_wert: int, mit_moehre: bool) -> String:
	var liste := I18nService.items(SPRUECHE_MOEHRE if mit_moehre else SPRUECHE_LEER)
	var idx := spruch_index(seed_wert, liste.size())
	return "" if idx < 0 else String(liste[idx])
