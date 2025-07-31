# UI Components Documentation

## Header & Navigation System

### Overview
The application features a modern header design with a centered logo and slide-out side menu, providing an intuitive navigation experience similar to popular mobile applications like Threads.

### Header Component (`components/header.tsx`)

#### Structure
- **Left Side**: Animated menu button (hamburger/X icon)
- **Center**: Company logo with theme-aware styling
- **Right Side**: Reserved space for future controls

#### Features
- **Animated Menu Button**: Smooth transition between Menu and X icons
- **Responsive Design**: Adapts to various screen sizes
- **Header Visibility**: Auto-hide/show on scroll using `useHeaderVisibility` hook
- **Theme Integration**: Works seamlessly with dark/light mode

#### Props
```typescript
interface HeaderProps {
  isMenuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}
```

### Side Menu Component (`components/side-menu.tsx`)

#### Features
- **Push Animation**: Entire app content slides to the right (not overlay)
- **Backdrop Interaction**: Click outside to close menu
- **Keyboard Support**: Escape key to close
- **Body Scroll Prevention**: Prevents background scrolling when open
- **Responsive Width**: Maximum 80vw on smaller screens

#### Menu Contents
1. **System Status Section**
   - Live news indicator with connection status
   - Real-time timestamp updates
   - Visual status indicators (green/orange dots)

2. **Language Selection**
   - Support for English, Simplified Chinese, Traditional Chinese
   - Dropdown interface with full language names
   - Analytics tracking for language changes

3. **Theme Controls**
   - Dark/light mode toggle
   - Smooth icon transitions
   - System preference detection

#### Technical Implementation
```typescript
interface SideMenuProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}
```

### Navigation UX Pattern

#### Push Effect Implementation
The side menu uses a "push" animation pattern where:
1. Menu slides in from the left
2. Main app content translates to the right by the menu width
3. Creates a native app-like experience
4. Backdrop provides visual separation

#### CSS Transform Classes
```css
/* Main content wrapper */
.translate-x-80        /* Push content 320px right */
.max-sm:translate-x-[80vw] /* Responsive push on small screens */

/* Side menu positioning */
.translate-x-0         /* Menu visible */
.-translate-x-full     /* Menu hidden */
```

### Responsive Design

#### Breakpoints
- **Desktop**: 320px (80) menu width
- **Mobile**: 80vw maximum width to prevent overflow
- **Touch Targets**: Minimum 44px for accessibility

#### Mobile Optimizations
- Touch-friendly button sizes
- Smooth transitions for better perceived performance
- Proper viewport handling
- Safe area considerations

### Accessibility Features

#### Keyboard Navigation
- Tab navigation through menu items
- Escape key to close menu
- Focus management when opening/closing

#### Screen Reader Support
- Proper ARIA labels on interactive elements
- Semantic HTML structure
- Descriptive button labels that change based on state

#### Visual Indicators
- High contrast status indicators
- Clear visual hierarchy
- Consistent iconography

### Animation Details

#### Timing
- **Menu Slide**: 300ms ease-in-out
- **Icon Transition**: 200ms for button state changes
- **Backdrop Fade**: 300ms opacity transition

#### Performance
- CSS transforms for hardware acceleration
- Minimal reflows during animations
- Optimized transition properties

### Integration with App Layout

#### State Management
The menu state is managed at the app level (`app/page.tsx`) and passed down to:
- Header component for button state
- Side menu component for visibility
- Main content wrapper for push effect

#### Component Tree
```
HomePage
├── SideMenu (positioned absolutely)
└── MainContentWrapper (transforms with menu state)
    ├── Header
    ├── StickyCategorySelector  
    ├── MainContent
    └── FooterNav
```

### Future Enhancements

#### Planned Features
- Gesture support for swipe-to-open
- Menu item animations
- Additional navigation items
- User preferences storage

#### Extensibility
The side menu is designed to accommodate additional controls and navigation items as the application grows.