// countries.js — ISO 3166-1 alpha-2 country name → code mapping
const COUNTRY_NAME_TO_CODE = {
  // Africa (HNG-focused)
  "nigeria": "NG", "ghana": "GH", "kenya": "KE", "ethiopia": "ET",
  "tanzania": "TZ", "uganda": "UG", "south africa": "ZA", "egypt": "EG",
  "cameroon": "CM", "ivory coast": "CI", "cote d'ivoire": "CI",
  "senegal": "SN", "mali": "ML", "burkina faso": "BF", "niger": "NE",
  "guinea": "GN", "benin": "BJ", "togo": "TG", "sierra leone": "SL",
  "liberia": "LR", "gambia": "GM", "mauritania": "MR", "cape verde": "CV",
  "angola": "AO", "mozambique": "MZ", "zambia": "ZM", "zimbabwe": "ZW",
  "malawi": "MW", "botswana": "BW", "namibia": "NA", "madagascar": "MG",
  "rwanda": "RW", "burundi": "BI", "somalia": "SO", "djibouti": "DJ",
  "eritrea": "ER", "sudan": "SD", "south sudan": "SS", "chad": "TD",
  "central african republic": "CF", "democratic republic of congo": "CD",
  "drc": "CD", "congo": "CG", "gabon": "GA", "equatorial guinea": "GQ",
  "sao tome and principe": "ST", "comoros": "KM", "seychelles": "SC",
  "mauritius": "MU", "tunisia": "TN", "algeria": "DZ", "morocco": "MA",
  "libya": "LY", "lesotho": "LS", "eswatini": "SZ", "swaziland": "SZ",

  // Europe
  "united kingdom": "GB", "uk": "GB", "great britain": "GB",
  "france": "FR", "germany": "DE", "italy": "IT", "spain": "ES",
  "portugal": "PT", "netherlands": "NL", "belgium": "BE",
  "switzerland": "CH", "austria": "AT", "sweden": "SE", "norway": "NO",
  "denmark": "DK", "finland": "FI", "poland": "PL", "czech republic": "CZ",
  "hungary": "HU", "romania": "RO", "bulgaria": "BG", "greece": "GR",
  "turkey": "TR", "ukraine": "UA", "russia": "RU",

  // Americas
  "united states": "US", "usa": "US", "america": "US",
  "canada": "CA", "mexico": "MX", "brazil": "BR", "argentina": "AR",
  "colombia": "CO", "chile": "CL", "peru": "PE", "venezuela": "VE",
  "ecuador": "EC", "bolivia": "BO", "paraguay": "PY", "uruguay": "UY",
  "cuba": "CU", "haiti": "HT", "jamaica": "JM",

  // Asia
  "china": "CN", "japan": "JP", "india": "IN", "south korea": "KR",
  "north korea": "KP", "indonesia": "ID", "philippines": "PH",
  "vietnam": "VN", "thailand": "TH", "malaysia": "MY",
  "singapore": "SG", "myanmar": "MM", "cambodia": "KH",
  "pakistan": "PK", "bangladesh": "BD", "sri lanka": "LK",
  "saudi arabia": "SA", "iran": "IR", "iraq": "IQ",
  "united arab emirates": "AE", "uae": "AE", "israel": "IL",
  "jordan": "JO", "lebanon": "LB", "syria": "SY",

  // Oceania
  "australia": "AU", "new zealand": "NZ",
};

const COUNTRY_CODE_TO_NAME = Object.fromEntries(
  Object.entries(COUNTRY_NAME_TO_CODE).map(([name, code]) => [code, name])
);

// Deduplicated version — prefer longer/more-official names for reverse lookup
const CODE_TO_FULL_NAME = {
  "NG": "Nigeria", "GH": "Ghana", "KE": "Kenya", "ET": "Ethiopia",
  "TZ": "Tanzania", "UG": "Uganda", "ZA": "South Africa", "EG": "Egypt",
  "CM": "Cameroon", "CI": "Côte d'Ivoire", "SN": "Senegal", "ML": "Mali",
  "BF": "Burkina Faso", "NE": "Niger", "GN": "Guinea", "BJ": "Benin",
  "TG": "Togo", "SL": "Sierra Leone", "LR": "Liberia", "GM": "Gambia",
  "MR": "Mauritania", "CV": "Cape Verde", "AO": "Angola", "MZ": "Mozambique",
  "ZM": "Zambia", "ZW": "Zimbabwe", "MW": "Malawi", "BW": "Botswana",
  "NA": "Namibia", "MG": "Madagascar", "RW": "Rwanda", "BI": "Burundi",
  "SO": "Somalia", "DJ": "Djibouti", "ER": "Eritrea", "SD": "Sudan",
  "SS": "South Sudan", "TD": "Chad", "CF": "Central African Republic",
  "CD": "Democratic Republic of Congo", "CG": "Congo", "GA": "Gabon",
  "GQ": "Equatorial Guinea", "ST": "São Tomé and Príncipe", "KM": "Comoros",
  "SC": "Seychelles", "MU": "Mauritius", "TN": "Tunisia", "DZ": "Algeria",
  "MA": "Morocco", "LY": "Libya", "LS": "Lesotho", "SZ": "Eswatini",
  "GB": "United Kingdom", "FR": "France", "DE": "Germany", "IT": "Italy",
  "ES": "Spain", "PT": "Portugal", "NL": "Netherlands", "BE": "Belgium",
  "CH": "Switzerland", "AT": "Austria", "SE": "Sweden", "NO": "Norway",
  "DK": "Denmark", "FI": "Finland", "PL": "Poland", "CZ": "Czech Republic",
  "HU": "Hungary", "RO": "Romania", "BG": "Bulgaria", "GR": "Greece",
  "TR": "Turkey", "UA": "Ukraine", "RU": "Russia",
  "US": "United States", "CA": "Canada", "MX": "Mexico", "BR": "Brazil",
  "AR": "Argentina", "CO": "Colombia", "CL": "Chile", "PE": "Peru",
  "VE": "Venezuela", "EC": "Ecuador", "BO": "Bolivia", "PY": "Paraguay",
  "UY": "Uruguay", "CU": "Cuba", "HT": "Haiti", "JM": "Jamaica",
  "CN": "China", "JP": "Japan", "IN": "India", "KR": "South Korea",
  "KP": "North Korea", "ID": "Indonesia", "PH": "Philippines",
  "VN": "Vietnam", "TH": "Thailand", "MY": "Malaysia", "SG": "Singapore",
  "MM": "Myanmar", "KH": "Cambodia", "PK": "Pakistan", "BD": "Bangladesh",
  "LK": "Sri Lanka", "SA": "Saudi Arabia", "IR": "Iran", "IQ": "Iraq",
  "AE": "United Arab Emirates", "IL": "Israel", "JO": "Jordan",
  "LB": "Lebanon", "SY": "Syria", "AU": "Australia", "NZ": "New Zealand",
};

function getCountryCode(name) {
  if (!name) return null;
  return COUNTRY_NAME_TO_CODE[name.toLowerCase().trim()] || null;
}

function getCountryName(code) {
  if (!code) return null;
  return CODE_TO_FULL_NAME[code.toUpperCase()] || code;
}

module.exports = { getCountryCode, getCountryName, CODE_TO_FULL_NAME };
