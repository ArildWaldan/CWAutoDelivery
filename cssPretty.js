// ==UserScript==
// @name         CSS pretty
// @namespace    http://tampermonkey.net/
// @version      2024-02-09
// @description  try to take over the world!
// @author       You
// @match        https://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @require      https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.0/anime.min.js
// @grant        none
// ==/UserScript==


let buttonOffset = 0

function createButton(buttonName, callbackFunction) {
    // Create a new button element
    const button = document.createElement('button');

    // Set the button's text content to the provided name
    button.textContent = buttonName;

    // Style the button with a high z-index
    button.style.position = 'absolute'; // Ensure z-index works by setting position
    button.style.zIndex = '10000'; // High z-index to ensure it's above most elements
    button.style.backgroundClip = 'padding-box';
    button.style.backgroundColor = '#0078d7'; // Consider using a different color for distinction if desired
    button.style.borderRadius = '5px';
    button.style.border = '1px solid #005cca';
    button.style.color = '#fff';
    button.style.display = 'inline-block';
    button.style.padding = '7px 10px';
    button.style.height = '30px';
    button.style.textDecoration = 'none';
    button.style.width = 'auto';
    button.style.cursor = 'pointer';
    button.style.margin = '10';
    button.style.font = 'bold 1em / 1.25 Arial,Helvetica,sans-serif';
    button.style.whiteSpace = 'nowrap';
    button.style.top = `${buttonOffset}px`; // Use buttonOffset to position button vertically
    button.style.left = '10px';
    button.id = buttonName
    //ajouts
    button.style.transition = 'all 1s ease-in-out, background-color 0.01s ease-in'



    // Attach the provided function as an event listener to the button
    button.addEventListener('click', callbackFunction);
    button.addEventListener("mouseover", function() {
        this.style.backgroundColor = "blue"; // Example of changing style directly
        this.classList.add("hover-style"); // Adding a class that defines :hover styles
    });

    button.addEventListener("mouseout", function() {
        this.style.backgroundColor = "#0078d7"; // Resetting the background color
        this.classList.remove("hover-style"); // Removing the class
    });

    // Append the button to the body of the document
    document.body.appendChild(button);
    buttonOffset += 40;
}



// Custom notifications
function createCustomNotification(message) {
    const notification = document.createElement("div");
    notification.innerText = "Ceci est un exemple de notification";
    notification.style.position = "fixed";
    notification.style.top = "50%";
    notification.style.left = "50%";
    notification.style.transform = "translate(-50%, -50%)";
    notification.style.backgroundColor = "#0078d7";
    notification.style.color = "white";
    notification.style.padding = "20px";
    notification.style.borderRadius = "40px";
    notification.style.boxShadow = "0 10px 8px rgba(0,0,0,0.2)";
    notification.style.fontSize = "100%";
    notification.style.zIndex = "1000";


    //ajouts
    notification.style.font = 'bold 1em / 1.25 Arial,Helvetica,sans-serif';
    notification.style.transition = "opacity 1s ease-in, opacity 2s ease-out";
    notification.style.opacity = "0";

    document.body.appendChild(notification);
    notification.style.opacity = "1";

    setTimeout(() => {
        notification.remove();
    }, 6000); // Dismiss after 6 seconds
}

function fadeOut(){
    setTimeout(() => {
        this.style.opacity = 0; // Initiate fadeout
    }, 6000);

    setTimeout(() => {
        this.remove();
    }, 8000);
}

let popupWindow = null;
let message = "Ceci est un exemple d'alerte"


function notification(type, message, linkText,linkURL) {

    const notification = document.createElement("div");
    notification.innerText = message;
    notification.style.position = "fixed";
    notification.style.top = "50%";
    notification.style.left = "50%";
    //notification.style.transform = "translate(-50%, -50%)";
    notification.style.backgroundColor = "#af4c4c";
    notification.style.color = "white";
    notification.style.padding = "15px 30px";
    notification.style.borderRadius = "30px";
    notification.style.boxShadow = "0 0px 1px rgba(0,0,0,0.2)";
    notification.style.width = 'auto';
    notification.style.zIndex = "1000";
    notification.style.display = "flex";
    notification.style.flexDirection = "column";
    notification.style.alignItems = "center";
    notification.style.justifyContent = "center";
    notification.style.textAlign = "center";
    //ajouts
    notification.style.font = 'bold 1em / 1.25 Arial,Helvetica,sans-serif';
    notification.style.fontSize = "110%";
    notification.style.transition = "all 0.5s ease-in-out";
    notification.style.opacity = "0";
    notification.style.transform = "translate(-50%, -50%) scale(0)";
    //conditionals
    if (type == "alert") {
        notification.style.background = "linear-gradient(to right, rgba(175,76,76), rgba(157,68,68))"; }
    else {
        notification.style.backgroundColor = "#0078d7";}


    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = "1";
        notification.style.transform = "translate(-50%, -50%) scale(1)";
        notification.style.boxShadow = "0 10px 8px rgba(0,0,0,0.4)"


    }, 10);


    // If linkText and linkURL are provided, create and append the hyperlink
    if (linkText && linkURL) {
        const hyperlink = document.createElement("a");
        hyperlink.href = linkURL;
        hyperlink.innerText = ` ${linkText}`; // Space added before link text for separation
        hyperlink.style.color = "#ffff00"; // Example: yellow color for visibility
        hyperlink.style.textDecoration = "underline";
        //hyperlink.target = "_blank"; // Optional: Opens the link in a new tab

        // Event listener to open link in a popup window
        hyperlink.addEventListener("click", function(event) {
            event.preventDefault(); // Prevent the default anchor action
            popupWindow = window.open(linkURL, "popupWindow", "width=400,height=400,scrollbars=no");
        });

        // Append the hyperlink to the notification
        notification.appendChild(hyperlink);


        const lineBreak = document.createElement("br");
        notification.appendChild(lineBreak);

        // Append the hyperlink to the notification
        notification.appendChild(hyperlink);

    }

    setTimeout(() => {
        notification.style.opacity = '0'; // Initiate fade-out
    }, 5000);

    setTimeout(() => {
        notification.remove();
    }, 6000);

}


// Define the LoaderManager object
const LoaderManager = {
    init: function() {
        this.injectLoaderHTML();
        this.injectCSS();
    },

    injectLoaderHTML: function() {
        const loaderHTML = `
            <div id="tmLoader" class="loader" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000;"></div>
        `;
        document.body.insertAdjacentHTML('beforeend', loaderHTML);
    },

    injectCSS: function() {
        const css = `
.loader {
        height: 5px;
        width: 5px;
        color: #3498db;
        box-shadow: -10px -10px 0 5px,
                    -10px -10px 0 5px,
                    -10px -10px 0 5px,
                    -10px -10px 0 5px;
        animation: loader-38 6s infinite;
      }

      @keyframes loader-38 {
        0% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px;
        }
        8.33% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px -10px 0 5px;
        }
        16.66% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px 10px 0 5px;
        }
        24.99% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        33.32% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px -10px 0 5px;
        }
        41.65% {
          box-shadow: 10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px -10px 0 5px;
        }
        49.98% {
          box-shadow: 10px 10px 0 5px,
                    10px 10px 0 5px,
                    10px 10px 0 5px,
                    10px 10px 0 5px;
        }
        58.31% {
          box-shadow: -10px 10px 0 5px,
                      -10px 10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        66.64% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        74.97% {
          box-shadow: -10px -10px 0 5px,
                      10px -10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        83.3% {
          box-shadow: -10px -10px 0 5px,
                      10px 10px 0 5px,
                      10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        91.63% {
          box-shadow: -10px -10px 0 5px,
                      -10px 10px 0 5px,
                      -10px 10px 0 5px,
                      -10px 10px 0 5px;
        }
        100% {
          box-shadow: -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px,
                      -10px -10px 0 5px;
        }
      }


  }
}
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = css;
        document.head.appendChild(styleSheet);
    },

    show: function() {
        const loader = document.getElementById('tmLoader');
        if (loader) loader.style.display = 'block';
    },

    hide: function() {
        const loader = document.getElementById('tmLoader');
        if (loader) loader.style.display = 'none';
    }
};

function createLoading(){
    window.LoaderManager.show()
}

// Initialize loader
LoaderManager.init();

// Attach LoaderManager to the window object to make it globally accessible
window.LoaderManager = LoaderManager;


function apparition (buttonName){
    const buttonId = buttonName.replace(/\s+/g, '_'); // Sanitize the button name to match the ID format
    const button = document.getElementById(buttonId);
    if (button) {
        button.style.opacity = '1'; // Make the button fully visible
    }
}


function disparition(buttonName) {
    const buttonId = buttonName.replace(/\s+/g, '_'); // Sanitize the button name to match the ID format
    const button = document.getElementById(buttonId);
    if (button) {
        button.style.opacity = '0'; // Make the button fully transparent
    }
}

(function() {
    'use strict';

    createButton("Notification", () => notification("", "This is a test notification :)"));
    createButton("Alertes", () => notification("alert", "This is a test alert :)", "Find out more", "www.wikipedia.com"));
    createButton("apparition", () =>apparition("Notification"));
    createButton("disparition",() =>disparition("Notification"));
    createButton("Progress", () =>createLoading());


})();
