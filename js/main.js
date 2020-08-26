/**
 * Copyright (c) 2020 Alexander Rose (MIT)
 *
 * @summary FILE.bg2save import, modification and export
 * @author Alexander <alexrosestudio@gmail.com>
 *
 * Created at     : 2020-08-18
 * Last modified  :
 */

/******************************************************************
 * The following deals with file import, modification, and export *
 ******************************************************************/
(function() {
    // Offset positions to important data
    const NAME_OFFSET = 372;
    const ALIGNMENT_OFFSET = 635;
    const EXPERIENCE_OFFSET = 24;
    const GENDER_OFFSET = 567;
    const GENDER_OFFSET2 = 629;
    const CLASS_OFFSET = 627;
    const CLASSKIT_OFFSET = 580;
    const RACE_OFFSET = 626;
    const STRENGTH_OFFSET = 568;
    const INTELLIGENCE_OFFSET = 570;
    const WISDOM_OFFSET = 571;
    const DEXTERITY_OFFSET = 572;
    const CONSTITUTION_OFFSET = 573;
    const CHARISMA_OFFSET = 574;
    const LEVEL_OFFSET = 564;

    /**************************************
     * File import and populate form data *
     **************************************/
    $("#file").on("change", (event) => {
        const $file = $("#file");
        const $form = $("#form");
        const $result = $("#result");
        const $result_block = $("#result_block");
        const $form_label = $("#form-label");

        $form_label.addClass("selected").html("Choose file");
        $result.html("");
        $result_block.removeClass("hidden").addClass("show");

        $file[0].files[0].name.endsWith(".bg2save") ?
            unzipFiles($file[0].files[0]).then(checkContents) : invalidate_input();

      /**
       * Checks if FILE.bg2save contents exist
       * @param {object} zipContents
       * @return {void}
       */
      function checkContents(zipContents) {
          let sav = false, gam = false, gamFile = {};
          if (zipContents.length <= 8)
              for (const file of zipContents) {
                  if (file.name === "BALDUR.gam")
                      sav = true;
                  if (file.name === "BALDUR.gam") {
                      gam = true;
                      gamFile = file;
                  }
              }
          return gam && sav ? updateFormData(gamFile) : invalidate_input();
      }

      /**
       * populates form data with info from FILE.gam
       * @param {gam} file
       * @return {void}
       */
      function updateFormData(file) {
          $form_label.addClass("selected").html(event.target.files[0].name);
          $result_block.removeClass("show").addClass("hidden");

          const data = file._data.compressedContent;

          const CRE_offset = findCRE(data);
          if (CRE_offset === -1)
              return invalidate_input();

          const $charName = $("#character-name");
          let charName = "";
          for (let i = NAME_OFFSET; i < NAME_OFFSET + 19; ++i)
              if (data[i])
                  charName = charName + String.fromCharCode(data[i]);
          $charName.val(charName);

          const $charClass = $("#character-class");
          const charClass = getValue(CLASS_LIST, data[CRE_offset + CLASS_OFFSET]);
          $charClass.val(charClass);

          const classKit = getValue(KIT_LIST, get_Uint32_LE(data, CRE_offset + CLASSKIT_OFFSET));
          $("#class-kit").val(classKit);
          $charClass.trigger("change", classKit);

          $("#alignment").val(getValue(ALIGNMENT_LIST, data[CRE_offset + ALIGNMENT_OFFSET]));
          $("#experience").val(get_Uint32_LE(data, CRE_offset + EXPERIENCE_OFFSET));
          $("#gender").val(getValue(GENDER_LIST, data[CRE_offset + GENDER_OFFSET]));
          $("#race").val(getValue(RACE_LIST, data[CRE_offset + RACE_OFFSET]));
          $("#strength").val(data[CRE_offset + STRENGTH_OFFSET]);
          $("#intelligence").val(data[CRE_offset + INTELLIGENCE_OFFSET]);
          $("#wisdom").val(data[CRE_offset + WISDOM_OFFSET]);
          $("#dexterity").val(data[CRE_offset + DEXTERITY_OFFSET]);
          $("#constitution").val(data[CRE_offset + CONSTITUTION_OFFSET]);
          $("#charisma").val(data[CRE_offset + CHARISMA_OFFSET]);
      }

      /**
       * Clears imported file and resets form
       * @return {void}
       */
      function invalidate_input() {
          $result.append($("<div>", {
              class : "alert alert-danger mb-3",
              text : $file[0].files[0].name
          }));
          $form.removeClass('was-validated');
          $form[0].reset();
      }
  });

    /********************************
     * File export and modification *
     ********************************/
    $("#form").on("submit", (event) => {
        const $file = $("#file");
        const $form = $("#form");

        //check if the form input has a value
        if (!$file.prop("files")[0]) {
            $form.removeClass('was-validated');
            $form[0].reset();
            return false;
        }
        //check if all input is valid
        for (const elem of $form[0])
            if (elem.checkValidity() === false)
                return false;

        //unzip the files and adjust BALDUR.gam
        unzipFiles($file.prop("files")[0]).then(processBg2save);

          /**
           * Calls functions to adjust, package and export new FILE.bg2save
           * @param {JSzip} contents
           * @return {void}
           */
          function processBg2save(contents) {
              let zip = new JSZip;

              for (const file of contents) {
                  if (file.name === "BALDUR.gam")
                      adjustGam(file);
                  zip.file(file.name, file._data.compressedContent);
              }

              zip.generateAsync({type : "blob"}).then( blob => {
                  saveAs(blob, randBrewName() + ".bg2save");
              });

              $("#form-label").addClass("selected").html("Choose file");
              $form.removeClass('was-validated');
              $form[0].reset();

              const $submission = $("#submit-button");
              $submission.prop("disabled", true);
              setTimeout(() => {
                  $submission.prop("disabled", false);
                  }, 3000);
          }

          /**
           * Replaces FILE.gam data with form data
           * @param {gam} file
           * @return {void}
           */
          function adjustGam(file) {
              const CRE_offset = findCRE(file._data.compressedContent);

              const charName = $("#character-name").val();
              if (charName)
                  for (let i = NAME_OFFSET, j = 0; j < 19; ++i, ++j)
                      file._data.compressedContent[i] = charName.length > j ? charName.charCodeAt(j) : 0;

              const charClass = $("#character-class").val(),
                  newClassKey = getKey(CLASS_LIST, charClass),
                  oldClassKey = file._data.compressedContent[CRE_offset + CLASS_OFFSET];
              if (charClass && newClassKey !== oldClassKey) {
                  file._data.compressedContent[CRE_offset + CLASS_OFFSET] = newClassKey;
                  file._data.compressedContent[CRE_offset + LEVEL_OFFSET] = 0;
                  file._data.compressedContent[CRE_offset + LEVEL_OFFSET + 1] = 0;
                  file._data.compressedContent[CRE_offset + LEVEL_OFFSET + 2] = 0;
                  file._data.compressedContent[CRE_offset + CLASSKIT_OFFSET] = 0;
                  file._data.compressedContent[CRE_offset + CLASSKIT_OFFSET + 1] = 0;
                  file._data.compressedContent[CRE_offset + CLASSKIT_OFFSET + 2] = 0;
                  file._data.compressedContent[CRE_offset + CLASSKIT_OFFSET + 3] = 0;
              }

              const gender = $("#gender").val();
              if (gender) {
                  file._data.compressedContent[CRE_offset + GENDER_OFFSET] = getKey(GENDER_LIST, gender);
                  file._data.compressedContent[CRE_offset + GENDER_OFFSET2] = getKey(GENDER_LIST, gender);
              }

              const alignment = $("#alignment").val();
              if (alignment) file._data.compressedContent[CRE_offset + ALIGNMENT_OFFSET] = getKey(ALIGNMENT_LIST, alignment);
              const experience = $("#experience").val();
              if (experience) set_Uint32_LE_in_Uint8arr(experience, file._data.compressedContent, CRE_offset + EXPERIENCE_OFFSET);
              const kit = $("#class-kit").val();
              if (kit) set_Uint32_LE_in_Uint8arr(getKey(KIT_LIST, kit), file._data.compressedContent, CRE_offset + CLASSKIT_OFFSET);
              const race = $("#race").val();
              if (race) file._data.compressedContent[CRE_offset + RACE_OFFSET] = getKey(RACE_LIST, race);
              const str = $("#strength").val();
              if (str) file._data.compressedContent[CRE_offset + STRENGTH_OFFSET] = str;
              const int = $("#intelligence").val();
              if (int) file._data.compressedContent[CRE_offset + INTELLIGENCE_OFFSET] = int;
              const wis = $("#wisdom").val();
              if (wis) file._data.compressedContent[CRE_offset + WISDOM_OFFSET] = wis;
              const dex = $("#dexterity").val();
              if (dex) file._data.compressedContent[CRE_offset + DEXTERITY_OFFSET] = dex;
              const con = $("#constitution").val();
              if (con) file._data.compressedContent[CRE_offset + CONSTITUTION_OFFSET] = con;
              const cha = $("#charisma").val();
              if (cha) file._data.compressedContent[CRE_offset + CHARISMA_OFFSET] = cha;
          }
    });

    /********************
     * HELPER FUNCTIONS *
     ********************/
    /**
     * returns unzipped file contents
     * @param {blob} file
     * @return {object}
     */
    async function unzipFiles(file) {
        return await JSZip.loadAsync(file).then((zip) => {
            let pathComps = [];
            zip.forEach(function(relativePath, zipEntry) {
                pathComps.push(zipEntry);
            });
            return pathComps;
        });
    }

    /**
     * Returns key pair to value in object literal
     * @param {object} object
     * @param {any} value
     * @return {any}
     */
    function getKey(object, value) {
        return Object.keys(object).find((property) => {
            return object[property] === value;
        });
    }

    /**
     * Returns value pair to key in object literal
     * @param {object} object
     * @param {any} key
     * @return {any}
     */
    function getValue(object, key) {
        return Object.values(object).find((undefined) => {
            return object[key] === undefined;
        });
    }

    /**
     * Returns a 32bit number from byte data
     * Converted from little endian
     * @param {Uint8Array} data
     * @param {number} offset
     * @return {number}
     */
    function get_Uint32_LE(data, offset) {
        return data[offset]
            | data[offset + 1] << 8
            | data[offset + 2] << 16
            | data[offset + 3] << 24;
    }

    /**
     * Replace data at offset with number value
     * @param {number} value
     * @param {Uint8Array} data
     * @param {number} offset
     * @return {void}
     */
    function set_Uint32_LE_in_Uint8arr(value, data, offset) {
        data[offset] = value;
        data[offset + 1] = value >> 8
        data[offset + 2] = value >> 16
        data[offset + 3] = value >> 24
    }

    /**
     * Returns the index of start of CREv1.0 data chunk
     * @param {Uint8Array} uint8_array
     * @return {number}
     */
  function findCRE(uint8_array) {
    return uint8_array.findIndex(function (element, index, array) {
      return (
        element === "C".charCodeAt(0) &&
        array[index + 1] === "R".charCodeAt(0) &&
        array[index + 2] === "E".charCodeAt(0) &&
        array[index + 3] === 32 &&
        array[index + 4] === "V".charCodeAt(0) &&
        array[index + 5] === "1".charCodeAt(0) &&
        array[index + 6] === ".".charCodeAt(0) &&
        array[index + 7] === "0".charCodeAt(0)
      );
    });
  }

  /**
   * Returns a random spirit, used for file naming
   */
  function randBrewName(){
      const brew = {
          1 : "Amberfire",
          2 : "Wyrmwizz",
          3 : "WizardsQuaff",
          4 : "Fireseed",
          5 : "BloodWine",
          6 : "Cherryfire",
          7 : "Dragonsdew",
          8 : "ElminstersChoice",
          9 : "FeyWine",
          10: "FlamingGullet"
      }
      return brew[Math.round(Math.random() * 10)];
  }

    const ALIGNMENT_LIST = {
        17 : "Lawful Good",
        18 : "Lawful Neutral",
        19 : "Lawful Evil",
        33 : "Neutral Good",
        34 : "True Neutral",
        35 : "Neutral Evil",
        49 : "Chaotic Good",
        50 : "Chaotic Neutral",
        51 : "Chaotic Evil"
    };
    const GENDER_LIST = {
        1 : "Male",
        2 : "Female"
    };
    const CLASS_LIST = {
        1  : "Mage",
        2  : "Fighter",
        3  : "Cleric",
        4  : "Thief",
        5  : "Bard",
        6  : "Paladin",
        7  : "Fighter Mage",
        8  : "Fighter Cleric",
        9  : "Fighter Thief",
        10 : "Fighter Mage Thief",
        11 : "Druid",
        12 : "Ranger",
        13 : "Mage Thief",
        14 : "Cleric Mage",
        15 : "Cleric Thief",
        16 : "Fighter Druid",
        17 : "Fighter Mage Cleric",
        18 : "Cleric Ranger",
        19 : "Sorcerer",
        20 : "Monk",
        21 : "Shaman"
    };
    const RACE_LIST = {
        1 : "Human",
        2 : "Elf",
        3 : "Half-Elf",
        4 : "Dwarf",
        5 : "Halfling",
        6 : "Gnome",
        7 : "Half-Orc"
    };
    const KIT_LIST = {
        0           : "",
        1073807360  : "Berserker",
        1073872896  : "Wizard Slayer",
        1073938432  : "Kensai",
        16384       : "Barbarian",
        1074200576  : "Archer",
        1074266112  : "Stalker",
        1074331648  : "Beast Master",
        1074003968  : "Cavalier",
        1074069504  : "Inquisitor",
        1074135040  : "Undead Hunter",
        1075838976  : "Blackguard",
        1074987008  : "Talos",
        1075052544  : "Helm",
        1075118080  : "Lathander",
        1076363264  : "Tyr",
        1076428800  : "Tempus",
        1074790400  : "Totemic",
        1074855936  : "Shapeshifter",
        1074921472  : "Avenger",
        4194304     : "Abjurer",
        8388608     : "Conjurer",
        16777216    : "Diviner",
        33554432    : "Enchanter",
        67108864    : "Illusionist",
        134217728   : "Invoker",
        268435456   : "Necromancer",
        536870912   : "Transmuter",
        32768       : "Wild Mage",
        1074397184  : "Assassin",
        1074462720  : "Bounty Hunter",
        1074528256  : "Swashbuckler",
        1075904512  : "Shadowdancer",
        1074593792  : "Blade",
        1074659328  : "Jester",
        1074724864  : "Skald",
        1076035584  : "Dragon Disciple",
        1076101120  : "Dark Moon",
        1076166656  : "Sun Soul"
    };
})();

/***********************************************
 * Various functions dealing with form styling *
 ***********************************************/
/**
 * Disabling form submissions if there are invalid fields
 */
(function() {
    window.addEventListener("load", () => {
        const _Function_call_ = document.getElementsByClassName("needs-validation");
        Array.prototype.filter.call(_Function_call_, (form) => {
            form.addEventListener("submit", (event) => {
                if (form.checkValidity() === false) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                form.classList.add("was-validated");
            }, false);
        });
    }, false);
})();

/**
 * adjust the class kit selection to be dropdown dependent of class selection
 */
(function() {
    $('#character-class').change( (event, param) => {
        const classIdLookup = {
            ["Fighter"] : ["", "Berserker", "Wizard Slayer", "Kensai", "Barbarian"],
            ["Ranger"]  : ["", "Archer", "Stalker", "Beast Master"],
            ["Paladin"] : ["", "Cavalier", "Inquisitor", "Undead Hunter", "Blackguard"],
            ["Cleric"]  : ["", "Talos", "Helm", "Lathander", "Tyr", "Tempus"],
            ["Druid"]   : ["", "Totemic", "Shapshifter", "Avenger"],
            ["Mage"]    : ["", "Abjurer", "Conjurer", "Diviner", "Enchanter", "Illusionist", "Invoker", "Necromancer", "Transmuter", "Wild Mage"],
            ["Thief"]   : ["", "Assassin", "Bounty Hunter", "Swashbuckler", "Shadowdancer"],
            ["Bard"]    : ["", "Blade", "Jester", "Skald"],
            ["Sorcerer"]: ["", "Dragon Disciple"],
            ["Monk"]    : ["", "Dark Moon", "Sun Soul"],
            ["Shaman"]  : [""],
            ["Fighter Mage"] : [""],
            ["Fighter Cleric"] : [""],
            ["Fighter Thief"] : [""],
            ["Fighter Mage Thief"] : [""],
            ["Mage Thief"] : [""],
            ["Cleric Mage"] : [""],
            ["Cleric Thief"] : [""],
            ["Fighter Druid"] : [""],
            ["Fighter Mage Cleric"] : [""],
            ["Cleric Ranger"] : [""]
        }
        const $class_kit = $("#class-kit");
        for (; $class_kit[0].options.length;) {
            $class_kit[0].remove(0);
        }

        const value = classIdLookup[event.target.options[event.target.selectedIndex].value];
        if (value)
            for (let i = 0; i < value.length; i++)
                $class_kit[0].options.add(new Option(value[i], value[i]));

        if (param) $class_kit.val(param)
    })
})();
