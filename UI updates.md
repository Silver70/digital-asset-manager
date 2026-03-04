# Digital Asset Management UI update

use tailwind css and shadcn ui to implement the following UI changes.

### **sidebar**

Insert "npx shadcn@latest add sidebar-07" and modify it for our application, this sidebar comes with a team-switcher which is perfect to act as our organization switcher which is at the very top so keep that one, the rest are just nav links, remove those we will only be displaying our folders, we will have the title as folders than on the right at the same line as the folders we will have a plus "+" button to create new folders, and no need to put any separator between the organization switcher and the links in our case it will be the folders, the sidebar already comes with reasonable gap between those so keep that, This sidebar comes with a sidebar footer which displays user profile which we don't need here so remove that.

### Header

The sidebar shell by default comes with bread crumbs at the header remove those and put At the very start side the left side a search bar, than on the very right side on the same line as search bar put a slider set it at 50% this does not need to work for now just keep it as static ui for now, than put the filter button when clicked shows our filtering options, than next to it we will have a dark/light mode toggler **_(it does not need to be functioning for now ),_ ** than next to it we will have our user profile when clicked will dropdown the option to Log out or sign out for now.

### Asset Cards

Keep the card ui simple and minimal just display the thumbnail image
