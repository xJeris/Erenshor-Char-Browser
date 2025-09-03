# Erenshor-Char-Browser
Character Browser for Erenshor

## Web File Structure
--> /var/www/server   
&nbsp;&nbsp;&nbsp;--> server.js   
--> /var/www/SiteRoot     
&nbsp;&nbsp;&nbsp;--> /assets   
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--> /items   
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--> /skills   
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--> /spells   
&nbsp;&nbsp;&nbsp;--> /data   
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--> characters.json   
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--> admin_key.txt   
&nbsp;&nbsp;&nbsp;--> app.js   
&nbsp;&nbsp;&nbsp;--> index.html   
&nbsp;&nbsp;&nbsp;--> items.xml   
&nbsp;&nbsp;&nbsp;--> package.json   
&nbsp;&nbsp;&nbsp;--> skills.xml   
&nbsp;&nbsp;&nbsp;--> spells.xml   
&nbsp;&nbsp;&nbsp;--> styles.css   

You can move the XML, JS, and CSS files into their own directories as needed. Just remember to update the paths to reflect the file structure change. The most important setup is to keep the server folder outside of your sites public path. You only want your node user to access that folder.

## Server Requirements
You will need to have the following packages installed.
- NPM
- Node.js
- Multer
- Bcrypt
- Express

Make sure your package.json reflects the correct versions of these packages for your server.

## Additional Notes
On startup of your node service, an admin_key file will be created with a randomly generated password. This will be saved as an encrypted value in the /data folder. They key will only be displayed once in your server console (can use journalctl). Otherwise, you will have to delete the file and restart the service to have it recreated.

This key allows the admin to delete uploaded characters should the need arise.
