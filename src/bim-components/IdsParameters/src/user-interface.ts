import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";

// The goal with this UI is to have a toolbar section with a dropdown list
// with the available properties and a button to update the selected element.
// The user should select a property from the dropdown, then an element from
// the allowed elements and then click on update
// to review the data to add to the element.

// These imports will be explained in the next sections
import { IdsParameters, Property } from "..";
import { confirmPropsModal } from "./confirm";

export function IdsUI(components: OBC.Components) {
  const parameters = components.get(IdsParameters);

  // The highlighter allows us to get the selected elements.
  const highlighter = components.get(OBF.Highlighter);

  // A dropdown to hold the available properties
  const propsDrop = document.createElement("bim-dropdown");
  propsDrop.label = "Property Name";

  propsDrop.addEventListener("change", () => {
    BUI.ContextMenu.removeMenus();
    // This method will be explained in the component section.
    parameters.restrictSelection(propsDrop.value[0]);
  });

  // When we want to confirm the addition of the new property
  // We will show a dialog with the data, more on that in the confirm section below.
  const onUpdateClick = (
    components: OBC.Components,
    property: Property,
    selection: FRAGS.FragmentIdMap,
  ) => {
    // We have to make sure there is a property and elements selected.
    if (Object.keys(selection).length === 0 || !property) return;
    const [confirm] = confirmPropsModal({
      components,
      property,
      selection,
      onSubmit: () => confirm.close(),
    });

    confirm.showModal();
  };

  // In the user-interface.ts file create an input element from the document.
  const input = document.createElement("input");

  const askForFile = (extension: string): Promise<File | null> => {
    return new Promise((resolve) => {
      input.type = "file";
      input.accept = extension;
      input.multiple = false;

      input.onchange = () => {
        const fileList = input.files;
        if (!fileList || fileList.length === 0) {
          resolve(null);
          return;
        }
        resolve(fileList[0]);
      };

      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  };

  const loadIds = async () => {
    const file = await askForFile(".ids");
    if (!file) return;
    const text = await file.text();
    await parameters.load(text);

    // When the IDS file is loaded, we will iterate the data to add the options
    // To the dropdown
    if (parameters.idsData) {
      const property = parameters.idsData.slice(-1)[0];
      const option = document.createElement("bim-option");
      option.label = property.name;
      option.value = property;

      propsDrop.append(option);
    }
  };

  return BUI.html`
  <bim-toolbar-section label="IDS Selection" icon="catppuccin:properties">
    ${propsDrop}
    <bim-button label="Update" @click=${() => onUpdateClick(components, propsDrop.value[0], highlighter.selection.select)}></bim-button>
    <bim-button label="Load File" @click=${() => loadIds()}></bim-button>
  </bim-toolbar-section>`;
}
