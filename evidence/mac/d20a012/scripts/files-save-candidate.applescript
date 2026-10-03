on run argv
set ownerPID to (item 1 of argv) as integer
set folderPath to item 2 of argv
set leafName to item 3 of argv
set operation to item 4 of argv
tell application "System Events"
set ownerProcess to first application process whose unix id is ownerPID
tell ownerProcess
log {"owner", ownerPID, name, frontmost}
if name is not "Cortex" or frontmost is not true then error "Save owner mismatch"
if operation is "cancel" and not (exists sheet 1 of window 1) then return "no-owned-save-sheet"
repeat 30 times
if exists sheet 1 of window 1 then exit repeat
delay 0.1
end repeat
log {"sheet-count", count of sheets of window 1}
if (count of sheets of window 1) is not 1 then error "Expected one Save sheet"
set panel to sheet 1 of window 1
set saveButtons to {}
set fields to {}
set cancelButtons to {}
repeat with element in (entire contents of panel)
if role of element is "AXButton" and name of element is "Save" then set end of saveButtons to contents of element
if role of element is "AXButton" and name of element is "Cancel" then set end of cancelButtons to contents of element
if role of element is "AXTextField" then
log {"text-field", role of element, value of element}
if value of element is leafName then set end of fields to contents of element
end if
end repeat
log {"save-sheet", role of panel, position of panel, size of panel, count of saveButtons, count of fields}
if role of panel is not "AXSheet" or (count of saveButtons) is not 1 or (count of fields) is not 1 then error "Save controls mismatch"
set nameField to item 1 of fields
log {"filename", value of nameField}
if operation is "cancel" then
if exists sheet 1 of panel then error "Nested dialog retained for coordinator"
if (count of cancelButtons) is not 1 then error "Cancel button mismatch"
click (item 1 of cancelButtons)
return "owned-save-cancelled"
end if
if operation is not "save" then error "Invalid native operation"
set value of nameField to leafName
if value of nameField is not leafName then error "Save filename mismatch"
keystroke "g" using {command down, shift down}
repeat 20 times
if exists sheet 1 of panel then exit repeat
delay 0.1
end repeat
if (count of sheets of panel) is not 1 then error "Go to Folder sheet missing"
set field to value of attribute "AXFocusedUIElement" of ownerProcess
log {"go-to-folder", role of field, count of sheets of panel}
if role of field is not "AXTextField" then error "Go to Folder focus mismatch"
keystroke "a" using {command down}
keystroke folderPath
if value of field is not folderPath then error "Go to Folder value mismatch"
log {"folder-value", value of field}
key code 36
repeat 20 times
if not (exists sheet 1 of panel) then exit repeat
delay 0.1
end repeat
if exists sheet 1 of panel then error "Go to Folder did not close"
if frontmost is not true or value of nameField is not leafName then error "Save owner or filename changed"
click (item 1 of saveButtons)
repeat 20 times
if not (exists sheet 1 of window 1) then exit repeat
delay 0.1
end repeat
log {"after-save", count of sheets of window 1}
if exists sheet 1 of window 1 then error "Save sheet did not close"
end tell
end tell
return "native-save-clicked"
end run