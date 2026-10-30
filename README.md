# Solar System Touring Guide

Direct access to run: https://fengziqian0206.github.io/Solar-System/

How to play: 

"WASD" to move; "Space" to trigger events; "Double-click" to enter the game mode; "ESC" to exit

Project Introduction

This project is an interactive experience built on my original solar system visualisation. Instead of simply showing planetary data and information, I wanted users to enter the point-cloud universe and explore it through interaction.

Players can enter full-screen game mode and control a strange planet from a third-person view. The planet can move freely through the solar system, with constantly changing colours, a repulsion field and a movement trail. It can push nearby point clouds away and temporarily change the colours of other planets. Players can also press the Space key to trigger random events, such as turning into a black hole or activating other special effects that can change the entire virtual solar system.

Players can move freely, observe the effects of their actions and trigger unexpected events at any time, making the solar system constantly change through their interactions.

<img width="3440" height="1440" alt="11" src="https://github.com/user-attachments/assets/dfbc8da3-0a4d-4bc8-a0ce-aa63f9e3e6e0" />

<img width="3440" height="1440" alt="1 5" src="https://github.com/user-attachments/assets/c5b5f4ed-aa9f-45e4-8a31-97569819c8d0" />

<img width="3440" height="1440" alt="22" src="https://github.com/user-attachments/assets/3ca306aa-d954-4245-afa4-86b7cfcfc536" />

<img width="3440" height="1440" alt="33" src="https://github.com/user-attachments/assets/95ea7067-2457-40ea-bcff-ada88f7d0438" />

<img width="3440" height="1440" alt="44" src="https://github.com/user-attachments/assets/ec764d4c-1af0-4d66-97ea-edb899be5352" />

<img width="3440" height="1440" alt="55" src="https://github.com/user-attachments/assets/ce7bf4cd-fc2a-4ea6-8d69-29d4eb50df17" />

The main loop :

Move around → Discover the repulsion effect → Observe the movement trail → See how your actions affect other planets → Trigger a random event at any time → Change the solar system → Restore it and start again.

The main idea is to let players explore, experiment and see how their actions can change the whole solar system.

<img width="1280" height="900" alt="main2" src="https://github.com/user-attachments/assets/90059f90-e774-4e0c-bf62-cbe7ee7ab203" />

Assignment 2（Previous content）：

<img width="2750" height="1816" alt="main" src="https://github.com/user-attachments/assets/0cd90d7d-ed94-4b5c-aa8c-5092c2600380" />

This is the motion simulation of the eight planets in the solar system : Based on the real revolution period, eccentricity and Kepler equation of the eight planets.
I want to build a miniature three-dimensional solar system in the form of a whole system lattice. The color depth and size of the lattice represent the known tangible objects in space, and these information change with time.

You can :
1. Drag the mouse or scroll wheel to zoom and observe from different perspectives.
2. Click the full screen view window. 
3. Change the number of point clouds or change the time rate.
4. Click "follow" behind different planets to follow the planetary perspective.
5. Switch the data visualization chart.

Information details：Data source: https://ssd.jpl.nasa.gov/planets/approx_pos.html

SEMI-MAJOR AXIS (AU)	PERIOD (DAYS)	PERIOD (EARTH YEARS)	MEAN SPEED (km/s)	MEAN RADIUS (km)

  Mercury 0.3871 87.969	0.241	47.36	2,439.7

  Venus 0.7233 224.701 0.615 35.02 6,051.8

  Earth 1.0000 365.256 1.000 29.78 6,371

  Mars 1.5237	686.98	1.881	24.07	3,389.5

  Jupiter 5.2028 4,332.59	11.862 13.07	69,911

  Saturn 9.5388	10,759.22	29.457 9.69	58,232

  Uranus 19.1914	30,688.5 84.019	6.81	25,362

  Neptune 30.0611	60,182 164.767 5.43	24,622

  Picture of this natural phenomenon：
  <img width="2880" height="817" alt="origin" src="https://github.com/user-attachments/assets/c71c86b0-3b0d-4eca-b2b6-2b1fd779f6de" />

