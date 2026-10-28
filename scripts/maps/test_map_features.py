"""python -X utf8 -m unittest discover -s scripts/maps   (run from BPM_Site; needs mpyq)"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from map_features import CLASSES, classify, size_factor  # noqa: E402


class Classify(unittest.TestCase):
    def test_grass_and_bushes_are_vision_blockers_we_draw(self):
        for name in ["Shakuras_TallGrass", "Bush", "Elsecaro_Bush1x1", "PortCity_Garden_Plants", "Brambles", "Slayn_Weeds"]:
            self.assertEqual(classify(name), "grass", name)

    def test_trees_rocks_columns(self):
        self.assertEqual(classify("HavenTree"), "tree")
        self.assertEqual(classify("Aiur_Trees_Tall"), "tree")
        self.assertEqual(classify("ChiseledRockLarge"), "rock")
        self.assertEqual(classify("ShakurasRockColumn"), "column")  # a column made of rock is still a column
        self.assertEqual(classify("JarbanMinor_Medium_Rock_Group"), "rock")

    def test_city_pieces(self):
        self.assertEqual(classify("Korhal_Residential_Building"), "building")
        self.assertEqual(classify("ChainLinkFenceStraight"), "wall")
        self.assertEqual(classify("UmojanLabCrates"), "prop")

    def test_flat_details_and_effects_are_skipped(self):
        for name in ["Protoss_Base_GroundTrim_Dark", "DecalProtoss", "InvisibleCurtain", "Tarsonis_Sidewalk_Straight", "Fog_Shakuras_Thick_Windy", "BloodSplats", "LightOmniRed"]:
            self.assertIsNone(classify(name), name)

    def test_crystals(self):
        self.assertEqual(classify("CrystalHuge"), "crystal")
        self.assertEqual(classify("SpaceMineralFormation2Doodad"), "crystal")

    def test_every_class_is_known_to_the_viewer(self):
        for name in ["Bush", "HavenTree", "ChiseledRock", "ShakurasRockColumn", "XelNaga_Temple_Small", "Korhal_Residential_Building", "ChainLinkFenceStraight", "CrystalHuge", "UmojanLabCrates"]:
            self.assertIn(classify(name), CLASSES)

    def test_size_words(self):
        self.assertGreater(size_factor("ChiseledRockLarge"), 1)
        self.assertLess(size_factor("XelNaga_Crates_Skinny"), 1)
        self.assertEqual(size_factor("Bush"), 1.0)


if __name__ == "__main__":
    unittest.main()
