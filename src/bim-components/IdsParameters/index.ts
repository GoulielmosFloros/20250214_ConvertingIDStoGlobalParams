import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as WEBIFC from "web-ifc";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

// This is the structure we want to have for each property.
export interface Property {
  specId: string; // Needed in case multiple specifications are loaded
  pSet: string; // Property set name
  name: string; // Property name
  type: string; // Data type of the property
  value: string | boolean | number; // Initially the threshold value from the IDS
}

export class IdsParameters extends OBC.Component {
  enabled = false;
  static readonly uuid = "fb6821d5-a9e2-4dd0-a46c-dcea964b875e";

  // This will hold the properties to be displayed in the UI
  idsData: Property[] = [];
  highlighter: OBF.Highlighter;

  constructor(components: OBC.Components) {
    super(components);
    components.add(IdsParameters.uuid, this);

    // We use the highlighter to highlight restricted elements
    // with the yellow color
    this.highlighter = this.components.get(OBF.Highlighter);
    this.highlighter.add("selectable", new THREE.Color("rgb(248, 236, 60)"));
  }

  // The overall purpose of the load method is to take an IDS file, traverse its content
  // and parse the information into the interface given above to store the data
  // into the idsData, then the array will be read in the UI.
  async load(fileData: string) {
    // Load the ids and read the data from the file. Each read adds the
    // data into the component incrementally.
    const ids = this.components.get(OBC.IDSSpecifications);
    const specs = ids.load(fileData);

    // For simplicity, we will take the first specification's requirements.
    const requirements = Array.from(specs[0].requirements);
    const specId = specs[0].identifier;

    for (const requirement of requirements) {
      // There are many facet, as we are working with properties
      // We need to confirm the requirement is actually a property
      if (requirement.facetType !== "Property") continue;

      // The particular structure of the property is {type, parameter}
      const _requirement = requirement as OBC.IDSProperty;

      if (
        !(
          // As seen in the interface, we must confirm the types
          // The dataType does not change so basically just confirm its existence
          (
            typeof _requirement.propertySet.parameter === "string" &&
            typeof _requirement.baseName.parameter === "string" &&
            _requirement.dataType &&
            _requirement.value?.type === "simple"
          )
        )
      )
        continue;

      const pSet = _requirement.propertySet.parameter;
      const name = _requirement.baseName.parameter;
      const type = _requirement.dataType;
      const value = _requirement.value?.parameter;

      this.idsData.push({ specId, pSet, name, type, value });
    }
  }

  // This method will highlight the elements to which the property can be applied.
  // Also restricts the selection of elements to those that were highlighted while the
  // property is selected in the dropdown.
  async restrictSelection(property: Property) {
    // When a property is deselected, this would remove the restriction
    // clear any selections made and clear the highlighted elements
    delete this.highlighter.selectable.select;
    this.highlighter.clear("selectable");
    this.highlighter.clear("select");

    // Also, there is no need to execute the rest of the code when a property
    // is deselected.
    if (!property) return;

    // The ids will contain the loaded specifications
    const ids = this.components.get(OBC.IDSSpecifications);
    // The fragment manager allows us to traverse the model
    const fragsManager = this.components.get(OBC.FragmentsManager);

    // For each model, check each id and data specification
    for (const [_, model] of fragsManager.groups.entries()) {
      for (const [id, data] of ids.list) {
        if (id !== property.specId) continue; // Here the ids should match.

        // Applicability contains the entities to which the specification can be
        // applied to.
        for (const entity of data.applicability) {
          // This will return the expressIds related to the entities.
          const entities = await entity.getEntities(model, {});

          // To then get the fragment map
          const fragsMap = model.getFragmentMap(entities);

          // With that fragment map, we can then restrict the selection
          // The key of the object must match the standard highlighter name
          // which is different from the custom one we created.
          this.highlighter.selectable = { select: fragsMap };
          // And then highlight with our custom highlighter.
          await this.highlighter.highlightByID("selectable", fragsMap, false);
        }
      }
    }
  }

  // As the name suggest, after confirming the addition, this method will
  // be executed to modify the model and add the new property.
  // There are three cases:
  // 1. The property exists and so the property set does too. Nothing needs to be done
  // 2. The property doesn't exists but the PSet does. Create and add the property.
  // 3. Nothing exists. Create both the PSet and the property and add them.
  async updateModel(property: Property, selection: FRAGS.FragmentIdMap) {
    // Just another check that elements and a property were selected.
    if (!(property || selection)) return;

    // The prop manager allows us to add the properties and property sets.
    // The indexer to find relations between elements of the IFC schema.
    // Fragments, again, to traverse the model.
    const propsManager = this.components.get(OBC.IfcPropertiesManager);
    const indexer = this.components.get(OBC.IfcRelationsIndexer);
    const fragments = this.components.get(OBC.FragmentsManager);
    const modelIdMap = fragments.getModelIdMap(selection);

    // For each model and its associated express ids of the selection...
    for (const [modelID, expressIDs] of Object.entries(modelIdMap)) {
      const model = fragments.groups.get(modelID);
      if (!model) continue;

      // Go through each expressId...
      for (const expressID of expressIDs) {
        // It must have a expressId related that "defines it"...
        const definitions = indexer.getEntityRelations(
          model,
          expressID,
          "IsDefinedBy",
        );

        // Placeholder for when the PSet exists
        let pset: Record<string, any> | null = null;

        // For each related expressId
        for (const defID of definitions) {
          const defAttrs = await model.getProperties(defID);
          if (!defAttrs) continue;

          // Check whether the PSet exists or not.
          if (defAttrs.Name?.name === property.pSet) {
            // Extract the properties to check if the one the be added exists.
            const properties = defAttrs.HasProperties;
            if (!properties) continue;

            for (const prop of properties) {
              const propValue = await model.getProperties(prop.value);
              if (!propValue) continue;

              // This check case number 1, so nothing is done.
              if (propValue.NominalValue?.name === property.name.toUpperCase())
                return;
            }
            // If the loop finishes, that means the property was not found.
            // But the PSet exists, case number 2.
            pset = defAttrs;
          }
        }

        // If pset was not updated, the PSet was not found, case number 3.
        if (!pset) {
          // Get model history.
          const { handle: ownerHistoryHandle } =
            await propsManager.getOwnerHistory(model);

          // Create a new PSet with WEBIFC.
          // THe IFC4 matches the version of my IFC file, you should check yours.
          pset = new WEBIFC.IFC4.IfcPropertySet(
            new WEBIFC.IFC4.IfcGloballyUniqueId(OBC.UUID.create()),
            ownerHistoryHandle,
            new WEBIFC.IFC4.IfcLabel(property.pSet),
            null,
            [],
          );

          // The PSet has been created but it must be added to the model.
          await propsManager.setData(model, pset);
        }

        // In the end, create the new property with the value from the selected one.
        // This block can raise an error, ignore it with the next comment.
        // @ts-ignore
        const newProp = await propsManager.newSingleProperty(
          model,
          property.type,
          property.name,
          property.value,
        );

        // Add it once more to the model.
        await propsManager.setData(model, newProp);
        // And push it to the PSet, either created or existent.
        pset.HasProperties.push(new WEBIFC.Handle(newProp.expressID));

        // And since IFC works with relations, assign the relationship between
        // the expressIds.
        indexer.addEntitiesRelation(
          model,
          expressID,
          {
            type: WEBIFC.IFCRELDEFINESBYPROPERTIES,
            inv: "IsDefinedBy",
          },
          pset.expressID,
        );
      }
    }
  }
}

export * from "./src";
