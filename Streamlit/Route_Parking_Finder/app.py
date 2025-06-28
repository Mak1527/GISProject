import streamlit as st
import requests
import folium
from streamlit_folium import st_folium
from streamlit_folium import folium_static
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
import osmnx as ox

# ORS API key
ORS_API_KEY = st.secrets['ORS_API_KEY']

# Streamlit config
st.set_page_config(page_title="Route & Parking Finder", layout="wide")
st.title("🗺️ Route & Parking Map")
st.write("Enter a start and end location to get route and nearby parking areas.")

# Step 1: Select start and end locations
start_loc = st.text_input("📍 Start Location", "Hannover, Germany")
end_loc = st.text_input("🏁 End Location", "Berlin, Germany")

# Step 2: Travel mode
mode = st.selectbox("Travel Mode", ["Car", "Walk", "Bike"])

button = st.button('Get Directions')

# Define a placeholder to display the distance and download button once computed.    
placeholder = st.empty()

# Geocoding
@st.cache_data
def geocode(query):
    parameters = {
        'api_key': ORS_API_KEY,
        'text' : query
    }

    response = requests.get(
         'https://api.openrouteservice.org/geocode/search',
         params=parameters)
    if response.status_code == 200:
     data = response.json()
    else:
     st.error('Request failed.')
    x, y = data['features'][0]['geometry']['coordinates']
    return (y, x)
    

# Step 3: Get route from OpenRouteService
def get_directions(start_loc, end_loc):    
    origin_coords = geocode(start_loc)
    destination_coords = geocode(end_loc)
    parameters = {
        'api_key': ORS_API_KEY,
        'start' : '{},{}'.format(origin_coords[1], origin_coords[0]),
        'end' : '{},{}'.format(destination_coords[1], destination_coords[0])
    }
    mode_dict = {
        'Car': 'driving-car',
        'Walk': 'foot-walking',
        'Bike': 'cycling-regular'
    }
    service_url = '{}/{}'.format(
        'https://api.openrouteservice.org/v2/directions',
        mode_dict[mode])
    response = requests.get(service_url, params=parameters)

    if response.status_code == 200:
        data = response.json()
    else:
        st.error('Request failed.')
        
    route= data['features'][0]['geometry']['coordinates']
    route_xy = [(y,x) for x, y in route]
    summary = data['features'][0]['properties']['summary']
    distance = round(summary['distance']/1000)  # kilometers
    duration_sec = summary['duration']
    hours = int(duration_sec // 3600)
    minutes = int((duration_sec % 3600) // 60)
    duration_text = f"{hours} hr {minutes} min" if hours > 0 else f"{minutes} min"

    tooltip = f'Distance by {mode}: {distance} km, Time: {duration_text} min'
    return route_xy, tooltip, distance, duration_text

# Step 4: Fetch nearby parking near start and end points
tags = {'amenity': ['parking', 'parking_space', 'parking_entrance']}
try:
    origin_coords = geocode(start_loc)
    destination_coords = geocode(end_loc)
    parking_start = ox.features_from_point(origin_coords, tags=tags, dist=800)
    parking_end = ox.features_from_point(destination_coords, tags=tags, dist=800)
except Exception as e:
    st.warning(f"Could not fetch parking data: {e}")
    parking_start = parking_end = None

# Step 4.5: Add fee filter
filter_type = st.selectbox("Show parking type", ["All", "Free only", "Paid only"])


# Step 5: Show map
m = folium.Map(location=[39.949610, -75.150282], zoom_start=5)
if start_loc:
    origin_coords = geocode(start_loc)
    folium.Marker(
        origin_coords,
        popup=start_loc,
        icon=folium.Icon(color='green', icon='crosshairs', prefix='fa')
        ).add_to(m)
    origin_bb = [
        (origin_coords[0] - 0.05, origin_coords[1] - 0.05),
        (origin_coords[0] + 0.05, origin_coords[1] + 0.05)]
    m.fit_bounds(origin_bb)
    
if end_loc:
    destination_coords = geocode(end_loc)
    folium.Marker(
        destination_coords,
        popup=end_loc,
        icon=folium.Icon(color='red', icon='crosshairs', prefix='fa')
        ).add_to(m)
if start_loc and end_loc:
    m.fit_bounds([origin_coords, destination_coords])

if button:
    route_xy, tooltip, distance, duration_text = get_directions(start_loc, end_loc)
    folium.PolyLine(route_xy, tooltip=tooltip).add_to(m)
    placeholder.text(tooltip)
    
   #Show total distance and time directly on screen
    st.markdown(f"**🛣️ Distance:** {distance} km")
    st.markdown(f"**⏱️ Estimated Time:** {duration_text} by {mode}")
    
    m.save('directions.html')
    with open('directions.html') as file:
        placeholder.download_button('Download Directions', data=file, file_name='directions.html')
    

# Parking

def should_include(row, filter_type):
    fee = str(row.get("fee", "")).lower()
    if filter_type == "Free only":
        return fee == "no"
    elif filter_type == "Paid only":
        return fee == "yes"
    else:
        return True  # "All"
        
        
# Parking near Start
if parking_start is not None and not parking_start.empty:
    for idx, row in parking_start.iterrows():
        if not should_include(row, filter_type):
            continue
        if row.geometry.geom_type == "Point":
            folium.CircleMarker(
                location=[row.geometry.y, row.geometry.x],
                radius=5,
                color="orange",
                fill=True,
                tooltip=f"🅿️ Start Parking (fee: {row.get('fee', 'unknown')})"
            ).add_to(m)
        elif row.geometry.geom_type == "Polygon":
            folium.GeoJson(
                row.geometry,
                style_function=lambda x: {
                    'fillColor': 'orange',
                    'color': 'orange',
                    'weight': 1,
                    'fillOpacity': 0.2
                },
                tooltip=f"🅿️ Start Area (fee: {row.get('fee', 'unknown')})"
            ).add_to(m)

# Parking near End
if parking_end is not None and not parking_end.empty:
    for idx, row in parking_end.iterrows():
        if not should_include(row, filter_type):
            continue
        if row.geometry.geom_type == "Point":
            folium.CircleMarker(
                location=[row.geometry.y, row.geometry.x],
                radius=5,
                color="purple",
                fill=True,
                tooltip=f"🅿️ End Parking (fee: {row.get('fee', 'unknown')})"
            ).add_to(m)
        elif row.geometry.geom_type == "Polygon":
            folium.GeoJson(
                row.geometry,
                style_function=lambda x: {
                    'fillColor': 'purple',
                    'color': 'purple',
                    'weight': 1,
                    'fillOpacity': 0.2
                },
                tooltip=f"🅿️ End Area (fee: {row.get('fee', 'unknown')})"
            ).add_to(m)

folium_static(m, height=600, width=900)
