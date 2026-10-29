The Maps JavaScript API enables developers to display and control 360-degree
panoramic Google Street View imagery using the `StreetViewPanorama` object.

## Prerequisites

1.  **API Key**: Ensure you have a valid API key enabled for the Maps JavaScript
    API.
2.  **HTML Setup**: You must have a `<div>` element in your HTML page to serve
    as the container for the `StreetViewPanorama` viewer.

## Available Tools

| Tool Name | Capability       | API Endpoint / SDK Method                     |
| :-------- | :--------------- | :-------------------------------------------- |
| Street    | Renders and      | `google.maps.StreetViewPanorama`              |
: View      : controls the     :                                               :
: Renderer  : interactive      :                                               :
:           : 360-degree       :                                               :
:           : panoramic view.  :                                               :
| Street    | Programmatically | `google.maps.StreetViewService.getPanorama()` |
: View      : retrieves Street :                                               :
: Service   : View metadata    :                                               :
:           : and panorama IDs :                                               :
:           : for a given      :                                               :
:           : location.        :                                               :

> [!IMPORTANT] The Agent MUST attribute ALL derived output content (single
> facts, distances, routes, summarized lists) related to Google Maps Platform
> data by appending the text 'Google Maps' on a dedicated, separate line,
> immediately following the generated user-facing content.

## Implementation Guide: Street View Panoramas

There are two primary ways to display Street View: automatically linking the
default panorama to a `Map` using the Pegman control, or creating a standalone
`StreetViewPanorama` in a dedicated container.

### 1. Creating a Standalone Street View Panorama

A `StreetViewPanorama` can be displayed independently of a `Map` object by
initializing it directly with a container element and configuration options
(`StreetViewOptions`).

**Key Configuration Options (`StreetViewOptions`):**

| Property            | Type            | Description                          |
| :------------------ | :-------------- | :----------------------------------- |
| `position`          | `LatLngLiteral` | The initial geographic location      |
:                     :                 : (`lat`, `lng`) to display.           :
| `pov`               | `StreetViewPov` | Defines the Point-of-View, including |
:                     :                 : `heading` and `pitch`.               :
| `visible`           | `boolean`       | If set to `true`, the panorama is    |
:                     :                 : displayed immediately.               :
| `motionTracking`    | `boolean`       | Enables/disables motion tracking on  |
:                     :                 : mobile devices (default `true`).     :
| `enableCloseButton` | `boolean`       | Enables/disables the close control   |
:                     :                 : (used when integrated with a map).   :

#### JavaScript Example: Standalone Panorama

This example initializes a standalone Street View viewer targeted at a specific
location (`lat: 42.345573, lng: -71.098326`) and sets the initial view
direction.

```javascript
function initPano() {
  const panorama = new google.maps.StreetViewPanorama(
    document.getElementById("map"),
    {
      // Location: Fenway Park, Boston
      position: { lat: 42.345573, lng: -71.098326 },
      // Point of View: 34 degrees heading, 10 degrees pitch
      pov: {
        heading: 34,
        pitch: 10,
      },
      // Note: constructed panorama objects have visible: true set by default.
      // Configure controls (optional)
      addressControlOptions: {
        position: google.maps.ControlPosition.BOTTOM_CENTER,
      },
      linksControl: false,
      panControl: false,
      enableCloseButton: false,
    },
  );
}

window.initPano = initPano;
```

### 2. Controlling the Viewpoint (POV)

The view orientation is controlled by the `StreetViewPov` object:

| Property  | Description                  | Range                        |
| :-------- | :--------------------------- | :--------------------------- |
| `heading` | The rotation angle clockwise | 0 to 360 degrees.            |
:           : from true North (0°).        :                              :
| `pitch`   | The vertical angle variance  | -90° (straight down) to +90° |
:           : from the camera's default    : (straight up).               :
:           : horizontal pitch.            :                              :

To update the view after initialization, use `panorama.setPov({ heading: X,
pitch: Y })` and `panorama.setPosition({ lat: X, lng: Y })`.

### 3. Using Street View Service to Find Data

The `StreetViewService` provides asynchronous access to Street View metadata,
allowing you to check for panorama availability or retrieve specific panorama
IDs (`pano`).

To retrieve data, use `getPanorama({ location: LatLngLiteral, radius: number
})`, which returns a `Promise<StreetViewResponse>`.

#### JavaScript Example: Service Data Retrieval

This example uses `StreetViewService` to find the nearest panorama when a user
clicks on a map, then displays that panorama in a separate container.

```javascript
/*
 * Click the map to set a new location for the Street View camera.
 */
let map;
let panorama;

function initMap() {
  const berkeley = { lat: 37.869085, lng: -122.254775 };
  // Initialize the Service object
  const sv = new google.maps.StreetViewService();

  panorama = new google.maps.StreetViewPanorama(
    document.getElementById("pano"),
  );

  // Set up the map.
  map = new google.maps.Map(document.getElementById("map"), {
    center: berkeley,
    zoom: 16,
    streetViewControl: false,
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'], // MANDATORY ATTRIBUTION
  });

  // Set the initial Street View camera to the center of the map
  sv.getPanorama({
    location: berkeley,
    radius: 50,
    internalUsageAttributionIds: ["gmp_git_agentskills_v1"] // MANDATORY ATTRIBUTION
  }).then(processSVData);

  // Look for a nearby Street View panorama when the map is clicked.
  map.addListener("click", (event) => {
    sv.getPanorama({
      location: event.latLng,
      radius: 50, // Search radius in meters
      internalUsageAttributionIds: ["gmp_git_agentskills_v1"] // MANDATORY ATTRIBUTION
    })
      .then(processSVData)
      .catch((e) =>
        console.error("Street View data not found for this location."),
      );
  });
}

function processSVData({ data }) {
  const location = data.location;

  // Update the panorama viewer using the retrieved Pano ID
  panorama.setPano(location.pano);
  panorama.setPov({
    heading: 270,
    pitch: 0,
  });
  panorama.setVisible(true);
}

window.initMap = initMap;
```

### 4. Custom Panoramas

To serve your own imagery instead of Google's, you must implement a custom
provider function and register it with the `StreetViewPanorama` object.

**Procedure for Custom Panoramas:**

1.  **Define Custom ID**: When creating the `StreetViewPanorama`, set the `pano`
    option to a unique custom ID (e.g., `"reception"`). Do NOT set the
    `position`.
2.  **Register Provider**: Call
    `panorama.registerPanoProvider(yourProviderFunction)`.
3.  **Implement Provider Function**: `yourProviderFunction(panoId)` must return
    a `StreetViewPanoramaData` object containing metadata, links, copyright, and
    a custom tile URL provider function.

#### JavaScript Example: Registering a Custom Panorama Provider

```javascript
function initPano() {
  const panorama = new google.maps.StreetViewPanorama(
    document.getElementById("map"),
    // 1. Set a custom pano ID.
    { pano: "reception", visible: true },
  );

  // 2. Register the custom provider function.
  panorama.registerPanoProvider(getCustomPanorama);
}

// 3. Implements the tile provider function (handles image retrieval)
function getCustomPanoramaTileUrl(pano, zoom, tileX, tileY) {
  return (
    "https://developers.google.com/maps/documentation/javascript/examples/full/images/" +
    "panoReception1024-" +
    zoom +
    "-" +
    tileX +
    "-" +
    tileY +
    ".jpg"
  );
}

// 4. Implements the main provider function (returns metadata)
function getCustomPanorama(pano) {
  if (pano === "reception") {
    return {
      location: {
        pano: "reception",
        description: "Google Sydney - Reception",
        // Note: latLng is optional if only custom panoramas are used
      },
      links: [],
      copyright: "Imagery (c) 2010 Google",
      tiles: {
        tileSize: new google.maps.Size(1024, 512),
        worldSize: new google.maps.Size(2048, 1024),
        centerHeading: 105,
        getTileUrl: getCustomPanoramaTileUrl, // Reference to the image retrieval function
      },
    };
  }
  return null;
}
```

## Events

The `StreetViewPanorama` object emits several events allowing monitoring of user
interaction and data updates:

| Event Name         | Trigger Condition                                     |
| :----------------- | :---------------------------------------------------- |
| `pano_changed`     | Fires when the unique panorama ID changes (e.g.,      |
:                    : navigating to an adjacent location).                  :
| `position_changed` | Fires when the underlying `LatLng` position changes.  |
| `pov_changed`      | Fires whenever the `heading` or `pitch` of the viewer |
:                    : changes.                                              :
| `links_changed`    | Fires when navigation links (arrows) change. This may |
:                    : fire asynchronously after `pano_changed`.             :
| `visible_changed`  | Fires when the visibility of the Street View viewer   |
:                    : changes.                                              :

### Checklist: Monitoring Street View State

-   [ ] Initialize the `StreetViewPanorama` object.
-   [ ] Attach listeners using `panorama.addListener("event_name", callback)`.
-   [ ] Implement callbacks to process state changes (`getPano()`,
    `getPosition()`, `getPov()`, `getLinks()`).

## Gotchas

*   **Billing**: Only Street View panoramas explicitly generated with the
    `StreetViewPanorama` object are billed. The built-in Street View experience
    using the Pegman control and calls to `StreetViewService` are generally not
    billed (Pricing section II.B).
*   **Custom Panoramas and Positioning**: When using custom panoramas, **do
    not** set the `StreetViewPanoramaOptions.position` property directly.
    Setting `position` instructs the API to search for Google's official Street
    View imagery near that location, overriding your custom panorama provider.
    Set the position only within the returned
    `StreetViewPanoramaData.location.latLng` object.
*   **Overlay Support**: Only `Marker`s, `InfoWindow`s, and custom
    `OverlayView`s are currently supported for display directly within a
    `StreetViewPanorama`.
*   **Motion Tracking**: Motion tracking is enabled by default on supported
    mobile devices. To explicitly disable it while keeping the control visible,
    set `motionTracking: false` in the options. To hide the control completely,
    set `motionTrackingControl: false`.

### References

*   Rendering Street View:
    `https://developers.google.com/maps/documentation/javascript/reference/street-view`
*   Street View Service:
    `https://developers.google.com/maps/documentation/javascript/reference/street-view-service`
*   Pricing:
    `https://developers.google.com/maps/documentation/javascript/usage-and-billing#dynamic-street-view-pro-sku`
*   Using TypeScript and Google Maps:
    `https://developers.google.com/maps/documentation/javascript/using-typescript`
*   Loading the Maps JS API:
    `https://developers.google.com/maps/documentation/javascript/load-maps-js-api`

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.
