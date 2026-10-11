use axum::Json;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Unit {
    /// Stored on the kind and shown next to values, e.g. `m³`.
    pub symbol: &'static str,
    /// Shown in the unit picker, e.g. `cubic metre`.
    pub label: &'static str,
}

#[derive(Debug, Serialize)]
pub struct UnitGroup {
    pub group: &'static str,
    pub units: &'static [Unit],
}

const fn u(symbol: &'static str, label: &'static str) -> Unit {
    Unit { symbol, label }
}

/// The fixed list of units a kind can use. Adding entries needs no migration.
pub const UNITS: &[UnitGroup] = &[
    UnitGroup {
        group: "Volume",
        units: &[
            u("L", "litre"),
            u("mL", "millilitre"),
            u("m³", "cubic metre"),
            u("gal", "US gallon"),
            u("ft³", "cubic foot"),
        ],
    },
    UnitGroup {
        group: "Energy",
        units: &[
            u("kWh", "kilowatt-hour"),
            u("Wh", "watt-hour"),
            u("MJ", "megajoule"),
            u("kcal", "kilocalorie"),
        ],
    },
    UnitGroup {
        group: "Power",
        units: &[u("W", "watt"), u("kW", "kilowatt")],
    },
    UnitGroup {
        group: "Mass",
        units: &[
            u("kg", "kilogram"),
            u("g", "gram"),
            u("lb", "pound"),
            u("oz", "ounce"),
            u("st", "stone"),
        ],
    },
    UnitGroup {
        group: "Length / distance",
        units: &[
            u("mm", "millimetre"),
            u("cm", "centimetre"),
            u("m", "metre"),
            u("km", "kilometre"),
            u("in", "inch"),
            u("ft", "foot"),
            u("mi", "mile"),
        ],
    },
    UnitGroup {
        group: "Temperature",
        units: &[u("°C", "degrees Celsius"), u("°F", "degrees Fahrenheit")],
    },
    UnitGroup {
        group: "Pressure",
        units: &[
            u("mbar", "millibar"),
            u("kPa", "kilopascal"),
            u("psi", "pounds per square inch"),
            u("mmHg", "millimetres of mercury"),
        ],
    },
    UnitGroup {
        group: "Time",
        units: &[u("s", "seconds"), u("min", "minutes"), u("h", "hours")],
    },
    UnitGroup {
        group: "Speed",
        units: &[
            u("km/h", "kilometres per hour"),
            u("mph", "miles per hour"),
            u("m/s", "metres per second"),
        ],
    },
    UnitGroup {
        group: "Health",
        units: &[
            u("bpm", "beats per minute"),
            u("mmol/L", "millimoles per litre"),
            u("mg/dL", "milligrams per decilitre"),
            u("%", "percent"),
        ],
    },
    UnitGroup {
        group: "Money",
        units: &[u("€", "euro"), u("$", "dollar"), u("£", "pound sterling")],
    },
    UnitGroup {
        group: "Count",
        units: &[u("count", "count"), u("steps", "steps")],
    },
    UnitGroup {
        group: "Other",
        units: &[u("units", "units")],
    },
];

pub fn is_known(symbol: &str) -> bool {
    UNITS
        .iter()
        .flat_map(|g| g.units)
        .any(|u| u.symbol == symbol)
}

pub async fn list() -> Json<&'static [UnitGroup]> {
    Json(UNITS)
}
