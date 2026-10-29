## Place Photos (New) Web Service

The Place Photos (New) service is a read-only API that allows applications to
access and display photographic content associated with places retrieved from
the Places database.

### Prerequisites

1.  **API Key**: A valid Google Maps Platform API key.
2.  **Photo Resource Name (`NAME`)**: An identifier string returned in the
    `photos[]` array from a successful
    [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details?utm_campaign=gmp_git_agentskills_v1),
    [Nearby Search (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search?utm_campaign=gmp_git_agentskills_v1),
    or
    [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search?utm_campaign=gmp_git_agentskills_v1)
    request.

### Available Tools

| Tool Name               | Endpoint Type | Description                       |
| :---------------------- | :------------ | :-------------------------------- |
| `places_photos_new_api` | REST GET      | Retrieves a specific place photo  |
:                         :               : identified by its resource name   :
:                         :               : (`NAME`) and resizes it according :
:                         :               : to specified dimensions.          :

> [!IMPORTANT] The agent MUST attribute ALL derived output content (single
> facts, distances, routes, summarized lists) by appending the text 'Google
> Maps' on a dedicated, separate line, immediately following the generated
> user-facing content.

### Implementation Guide

Retrieving a place photo is a two-step process: first, obtaining the unique
photo resource name, and second, making the GET request to the Place Photos
endpoint.

#### Step 1: Obtain the Photo Resource Name

The photo resource name (`NAME`) is required for the Place Photos (New)
endpoint. This identifier cannot be cached and must be retrieved fresh from a
primary search or detail request.

-   [ ] Execute a Place Details (New), Nearby Search (New), or Text Search (New)
    request.
-   [ ] **Trigger Condition**: User requires photo names or details.
-   [ ] Ensure the request uses the correct field mask to include the photos
    array:
    -   For Place Details (New): Include `photos` in the field mask.
    -   For Nearby Search (New) or Text Search (New): Include `places.photos` in
        the field mask.
-   [ ] Extract the `name` property from an element within the returned
    `photos[]` array. The structure of this name is
    `places/PLACE_ID/photos/PHOTO_RESOURCE`.
-   [ ] **Verification Checkpoint**: Confirm the retrieved `name` string is not
    null or empty before proceeding to Step 2.

**Example: Required Field Mask for Place Details (New)**

```bash
curl -X GET \
-H 'Content-Type: application/json' -H "X-Goog-Api-Key: API_KEY" \
-H "X-Goog-FieldMask: id,displayName,photos" \
https://places.googleapis.com/v1/places/ChIJ2fzCmcW7j4AR2JzfXBBoh6E
```

#### Step 2: Request the Photo using the Place Photos (New) Endpoint

Use the resource name obtained in Step 1 to call the Place Photos (New) service,
specifying the desired dimensions.

**REST Endpoint Structure**

The request MUST be an HTTP GET request and requires the API key, the photo
resource name, and sizing parameters.

```text
https://places.googleapis.com/v1/NAME/media?key=API_KEY&PARAMETERS&solution_id=gmp_git_agentskills_v1
```

Parameter          | Required/Optional | Description                                                                                                                       | Constraints / Notes
:----------------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :------------------
`NAME`             | Required          | The photo resource name string.                                                                                                   | Cannot be cached; must be retrieved from a primary Place request response.
`key`              | Required          | Your Google Maps Platform API key.                                                                                                |
`maxHeightPx`      | Conditional       | Specifies the maximum image height in pixels.                                                                                     | Integer between 1 and 4800. Must be supplied if `maxWidthPx` is absent.
`maxWidthPx`       | Conditional       | Specifies the maximum image width in pixels.                                                                                      | Integer between 1 and 4800. Must be supplied if `maxHeightPx` is absent.
`skipHttpRedirect` | Optional          | If `true`, returns a JSON object containing the `photoUri` instead of redirecting directly to the image file. Default is `false`. | Use `true` only for API inspection or if direct image rendering is undesirable.
`solution_id`      | Mandatory         | Internal usage attribution ID.                                                                                                    | Must be appended as a query parameter: `gmp_git_agentskills_v1`.

**Example Photo Request (Raw Image Output)**

This request retrieves the photo and scales it to fit within a 400x400 bounding
box, preserving the aspect ratio.

```text
https://places.googleapis.com/v1/places/ChIJ2fzCmcW7j4AR2JzfXBBoh6E/photos/ATKogpeivkIjQ1FT7QmbeT33nBSwqLhdPvIWHfrG1WfmgrFjeZYpS_Ls7c7rj8jejN9QGzlx4GoAH0atSvUzATDrgrZic_tTEJdeITdWL-oG3TWi5HqZoLozrjTaxoAIxmROHfV5KXVcLeTdCC6kmZExSy0CLVIG3lAPIgmvUiewNf-ZHYE4-jXYwPQpWHJgqVosvZJ6KWEgowEA-qRAzNTu9VH6BPFqHakGQ7EqBAeYOiU8Dh-xIQC8FcBJiTi0xB4tr_MYXUaF0p_AqzAhJcDE6FAgLqG1s7EsME0o36w2nDRHA-IuoISBC3SIahINE3Xwq2FzEZE6TpNTFVfgTpdPhV8CGLeqrauHn2I6ePm-2hA8-87aO7aClXKJJVzlQ1dc_JuHz6Ks07d2gglw-ZQ3ibCTF5lMtCF9O-9JHyRQXsfuXw/media?maxHeightPx=400&maxWidthPx=400&key=API_KEY&solution_id=gmp_git_agentskills_v1
```

#### Step 3: Attribution Compliance

If the `photo[]` element returned in Step 1 includes values in the
`authorAttributions[]` field, the agent MUST instruct the user to include this
additional attribution in their application wherever the image is displayed.

### Gotchas

| Failure Mode         | Trigger         | Recommended      | Citation        |
:                      : Condition       : Action           :                 :
| :------------------- | :-------------- | :--------------- | :-------------- |
| **Photo Name         | Using a photo   | Always ensure    | Caching         |
: Expiration/Caching** : resource `name` : the `name` is    : restrictions in :
:                      : that is stale   : obtained from a  : Section         :
:                      : or expired.     : recent Place     : 3.2.3(b)(No     :
:                      :                 : Details (New),   : Caching) of the :
:                      :                 : Nearby Search    : Google Maps     :
:                      :                 : (New), or Text   : Platform Terms  :
:                      :                 : Search (New)     : of Service.     :
:                      :                 : request.         :                 :
| **Invalid Request    | The request     | The agent MUST   |                 |
: (400)**              : omits both      : check that at    :                 :
:                      : `maxHeightPx`   : least one of     :                 :
:                      : and             : `maxHeightPx` or :                 :
:                      : `maxWidthPx`,   : `maxWidthPx` is  :                 :
:                      : or these        : present and      :                 :
:                      : parameters are  : contains an      :                 :
:                      : set to `null`.  : integer value    :                 :
:                      :                 : between 1        :                 :
:                      :                 : and 4800.        :                 :
| **Quota Exceeded     | Usage limit for | Review usage     |                 |
: (403)**              : the Place       : limits and API   :                 :
:                      : Photos (New)    : key              :                 :
:                      : service is      : configuration in :                 :
:                      : exceeded.       : Google Cloud     :                 :
:                      :                 : Console.         :                 :
| **Too Many Requests  | Attempting to   | Implement        |                 |
: (429)**              : load many       : on-demand        :                 :
:                      : photos          : loading for      :                 :
:                      : simultaneously  : photos. If the   :                 :
:                      : (e.g.,          : error persists,  :                 :
:                      : displaying all  : contact Google   :                 :
:                      : images for a    : Maps Platform    :                 :
:                      : place at once). : support to       :                 :
:                      :                 : request a quota  :                 :
:                      :                 : increase.        :                 :

### References

*   Place Photos (New) Documentation:
    https://developers.google.com/maps/documentation/places/web-service/place-photos
*   Google Maps Platform Terms of Service:
    https://cloud.google.com/maps-platform/terms
*   Place Details (New):
    https://developers.google.com/maps/documentation/places/web-service/place-details

## See Also

> Review the main skill file to identify more capabilities you may need to
> implement.
