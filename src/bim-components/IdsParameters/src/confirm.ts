import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import { IdsParameters, Property } from "..";

// Interface for the stateful component
interface AssignPropsModalState {
  components: OBC.Components;
  property: Property;
  selection: FRAGS.FragmentIdMap;
  onSubmit: () => void;
}

const template: BUI.StatefullComponent<AssignPropsModalState> = (state) => {
  const { components, property, selection, onSubmit } = state;
  const parameters = components.get(IdsParameters);

  // Give the dialog a unique id.
  const panelSectionID = `form-${BUI.Manager.newRandomId()}`;

  // This block will populate the form so when the user
  // sees the dialog, will know the details of the property to be added.
  const pset = document.createElement("bim-text-input");
  pset.label = "Property Set";
  pset.placeholder = property.pSet;
  const name = document.createElement("bim-text-input");
  name.label = "Property Name";
  name.placeholder = property.name;
  const type = document.createElement("bim-text-input");
  type.label = "Data Type";
  type.placeholder = property.type;
  const value = document.createElement("bim-text-input");
  value.label = "Value";
  value.placeholder = property.value as string;

  // The add function will get the respective dialog
  const onAdd = () => {
    const panelSection = document.getElementById(
      panelSectionID,
    ) as BUI.PanelSection;
    if (!panelSection) return;

    // If a value was given in the form, the data
    // from the property will be changed.
    // Else it will not be modified and the displayed data
    // will remain
    if (pset.value) property.pSet = pset.value;
    if (name.value) property.name = name.value;
    if (type.value) property.type = type.value;
    if (value.value) property.value = value.value;

    parameters.updateModel(property, selection);
    onSubmit();
  };

  return BUI.html`
    <dialog>
      <bim-panel>
        <bim-panel-section id=${panelSectionID} label="Confirm New Property" fixed>
          ${pset}
          ${name}
          ${type}
          ${value}
          <bim-button label="Add" @click=${onAdd}></bim-button>
        </bim-panel-section>
      </bim-panel> 
    </dialog>
  `;
};

export const confirmPropsModal = (state: AssignPropsModalState) => {
  const component = BUI.Component.create<
    HTMLDialogElement,
    AssignPropsModalState
  >(template, state);

  document.body.append(component[0]);

  return component;
};
