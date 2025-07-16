# Hong Kong Journey Time Indicators API Documentation

## Overview
The Hong Kong Transport Department provides real-time journey time data through the Journey Time Indicators System (JTIS). This API delivers traffic conditions and estimated journey times for major routes across Hong Kong, updated every 2 minutes.

## API Endpoint
```
GET https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml
```

## API Details
- **Format**: XML
- **Update Frequency**: Every 2 minutes (24/7 operation)
- **Provider**: Hong Kong Transport Department
- **Documentation**: [Data Specification PDF](https://static.data.gov.hk/td/journey-time-indicators-v2/dataspec/dataspec_jtis_en.pdf)
- **Contact**: tdenq@td.gov.hk | 28042600

## Data Structure

### XML Response Format
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<jtis_journey_list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                   xsi:schemaLocation="http://data.one.gov.hk/td http://data.one.gov.hk/xsd/td/journeytime.xsd" 
                   xmlns="http://data.one.gov.hk/td">
    <jtis_journey_time>
        <LOCATION_ID>H1</LOCATION_ID>
        <DESTINATION_ID>CH</DESTINATION_ID>
        <CAPTURE_DATE>2025-07-16T12:48:00</CAPTURE_DATE>
        <JOURNEY_TYPE>1</JOURNEY_TYPE>
        <JOURNEY_DATA>5</JOURNEY_DATA>
        <COLOUR_ID>3</COLOUR_ID>
        <JOURNEY_DESC/>
    </jtis_journey_time>
</jtis_journey_list>
```

### Field Definitions
| Field | Description | Example |
|-------|-------------|---------|
| `LOCATION_ID` | Starting location identifier | `H1`, `K01`, `N05`, `SJ3` |
| `DESTINATION_ID` | Destination location identifier | `CH`, `EH`, `WH`, `TKTL` |
| `CAPTURE_DATE` | Data capture timestamp (ISO 8601) | `2025-07-16T12:48:00` |
| `JOURNEY_TYPE` | Route type (always `1` for standard) | `1` |
| `JOURNEY_DATA` | Journey time in minutes | `5`, `10`, `25` |
| `COLOUR_ID` | Traffic condition indicator | `1`, `2`, `3` |
| `JOURNEY_DESC` | Additional description (usually empty) | `""` |

## Traffic Condition Codes

### COLOUR_ID Values
| Code | Status | Color | Description |
|------|--------|--------|-------------|
| `1` | Congested | 🔴 Red | Heavy traffic, significant delays |
| `2` | Slow | 🟡 Amber | Moderate traffic, some delays |
| `3` | Smooth | 🟢 Green | Light traffic, normal flow |

## Coverage Areas

### Hong Kong Island (H1-H11)
- **11 monitoring locations**
- Covers major districts and arterial roads
- Cross-harbour tunnel access points

### Kowloon (K01-K07)  
- **7 monitoring locations**
- Major Kowloon districts and highways
- Connection points to New Territories

### New Territories (N01-N13)
- **13 monitoring locations** 
- Covers Sha Tin, Tai Po, Tuen Mun, Yuen Long areas
- Strategic highway connections

### Strategic Routes (SJ1-SJ5)
- **5 special monitoring points**
- Critical traffic corridors
- Major infrastructure connections

## Major Destinations

### Cross-Harbour Tunnels
| Code | Tunnel Name | Description |
|------|-------------|-------------|
| `CH` | Cross-Harbour Tunnel | Original tunnel connecting HK Island-Kowloon |
| `EH` | Eastern Harbour Tunnel | Eastern crossing via Quarry Bay |
| `WH` | Western Harbour Tunnel | Western crossing via Kennedy Town |

### Key Areas
| Code | Location | Area |
|------|----------|------|
| `TKTL` | Tseung Kwan O | New Territories East |
| `TMCLK` | Tuen Mun | New Territories West |
| `TPR` | Tai Po | New Territories East |
| `TKOT` | Tseung Kwan O Tunnel | Major tunnel connection |
| `ATL` | Airport/Lantau | Airport corridor |
| `MOS` | Ma On Shan | New Territories East |

## Sample API Response Data

### Current Journey Times (as of 2025-07-16 12:48)
```
H1 → Cross-Harbour Tunnel: 5 minutes (Green)
H1 → Eastern Harbour: 10 minutes (Green)  
H2 → Cross-Harbour Tunnel: 7 minutes (Green)
H2 → Western Harbour: 10 minutes (Green)
```

## Integration Examples

### cURL Command
```bash
curl -s "https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml"
```

### Node.js Fetch
```javascript
const response = await fetch('https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml');
const xmlData = await response.text();
```

### Python requests
```python
import requests
response = requests.get('https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml')
xml_data = response.text
```

## Data Processing Notes

1. **XML Parsing Required**: Data comes as XML, not JSON
2. **Real-time Updates**: Refresh every 2 minutes for latest data
3. **No Authentication**: Public API, no API key required
4. **Consistent Structure**: All journey records follow same XML schema
5. **Date Format**: ISO 8601 timestamp format (`YYYY-MM-DDTHH:mm:ss`)

## Use Cases

- **Traffic Monitoring**: Real-time traffic condition dashboards
- **Route Planning**: Journey time estimation for navigation apps
- **Transport Analytics**: Historical traffic pattern analysis
- **Public Information**: Live traffic updates for commuters
- **Emergency Services**: Route optimization during incidents

## Rate Limiting & Best Practices

- **Update Frequency**: Data refreshes every 2 minutes
- **Polling Recommendation**: Poll no more frequently than every 2 minutes
- **Caching**: Implement local caching to reduce API calls
- **Error Handling**: Handle XML parsing errors gracefully
- **Backup Plans**: Prepare fallback for API unavailability

## Related Hong Kong Transport APIs

- **Bus ETA**: Real-time bus arrival data
- **MTR Status**: Railway service updates  
- **Traffic Speed Map**: Detailed road speed data
- **TDAS API**: Advanced traffic analytics system
- **HKeMobility**: Integrated transport information

---

*Last Updated: July 16, 2025*  
*API Status: ✅ Active and Operational*